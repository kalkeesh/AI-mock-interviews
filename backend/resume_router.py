import os
import json
import re
import requests
import pdfplumber
import docx
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from datetime import datetime

if __package__:
    from .db import get_interviews_collection
else:
    from db import get_interviews_collection

router = APIRouter()

HF_API_KEY = os.getenv("HF_API_KEY", "")
HF_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct"
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {HF_API_KEY}",
    "Content-Type": "application/json"
}

DEFAULT_EXTRACTED_INFO = {
    "name": "",
    "email": "",
    "phone": "",
    "summary": "",
    "skills": [],
    "education": "",
    "projects": "",
    "internships": "",
    "work_experience": "",
    "strengths": "",
    "hobbies": "",
}


def _extract_json_object(text: str):
    cleaned = text.strip()

    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        return json.loads(match.group(0))

    raise ValueError("No JSON object found in model output")


def _to_string_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _fallback_questions(resume_text: str, extracted_info: dict):
    known_skills = [
        "Python",
        "FastAPI",
        "Django",
        "Spring Boot",
        "MongoDB",
        "SQL",
        "React",
        "Java",
        "Kafka",
    ]

    skills = _to_string_list(extracted_info.get("skills"))
    skill_text = " ".join(skills) + " " + resume_text
    detected = [skill for skill in known_skills if re.search(rf"\b{re.escape(skill)}\b", skill_text, re.IGNORECASE)]

    technical = [f"Explain one production issue you solved using {skill}." for skill in detected[:5]]
    while len(technical) < 5:
        technical.append(
            [
                "How do you design a backend API for scalability and reliability?",
                "How do you optimize database performance for read-heavy workloads?",
                "How do you test and validate critical backend workflows?",
                "How do you monitor and debug failures in a deployed service?",
                "How do you secure authentication and sensitive data in APIs?",
            ][len(technical)]
        )

    hr = [
        "Tell me about yourself and your current role.",
        "Why do you want this role, and what value will you bring?",
        "Describe a time you handled feedback and improved your performance.",
    ]

    behavioral = [
        "Describe a situation where you had conflicting priorities and how you handled it.",
        "Tell me about a time you found a critical bug and how you managed the fix.",
    ]

    gd_topic = (
        "Discuss how you would design and deliver a production-ready backend feature "
        "from requirements gathering to deployment and monitoring."
    )
    gd_expected = (
        "A strong answer should cover requirement analysis, architecture choices, API/database design, "
        "testing strategy, deployment plan, observability, risks, and trade-offs."
    )

    return {
        "technical": technical,
        "hr": hr,
        "behavioral": behavioral,
        "group_discussion": {"topic": gd_topic, "expected_answer": gd_expected},
    }


def _normalize_result(parsed: dict, resume_text: str):
    extracted = parsed.get("extracted_information")
    if not isinstance(extracted, dict):
        extracted = {}

    normalized_extracted = DEFAULT_EXTRACTED_INFO.copy()
    normalized_extracted.update(extracted)
    normalized_extracted["skills"] = _to_string_list(normalized_extracted.get("skills"))

    questions = parsed.get("interview_questions")
    if not isinstance(questions, dict):
        questions = {}

    normalized_questions = {
        "technical": _to_string_list(questions.get("technical")),
        "hr": _to_string_list(questions.get("hr")),
        "behavioral": _to_string_list(questions.get("behavioral")),
    }

    gd = parsed.get("group_discussion")
    gd_topic = ""
    gd_expected = ""
    if isinstance(gd, dict):
        gd_topic = str(gd.get("topic") or gd.get("question") or "").strip()
        gd_expected = str(gd.get("expected_answer") or gd.get("expected_points") or "").strip()
    elif isinstance(gd, str):
        gd_topic = gd.strip()

    if not normalized_questions["technical"] or not normalized_questions["hr"] or not normalized_questions["behavioral"]:
        fallback = _fallback_questions(resume_text, normalized_extracted)
        normalized_questions["technical"] = normalized_questions["technical"] or fallback["technical"]
        normalized_questions["hr"] = normalized_questions["hr"] or fallback["hr"]
        normalized_questions["behavioral"] = normalized_questions["behavioral"] or fallback["behavioral"]

    if not gd_topic:
        fallback = _fallback_questions(resume_text, normalized_extracted)
        gd_topic = fallback["group_discussion"]["topic"]
        gd_expected = gd_expected or fallback["group_discussion"]["expected_answer"]

    return {
        "extracted_information": normalized_extracted,
        "interview_questions": normalized_questions,
        "group_discussion": {
            "topic": gd_topic,
            "expected_answer": gd_expected,
        },
    }


# -----------------------------------
# Extract Text from PDF
# -----------------------------------
def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


# -----------------------------------
# Extract Text from DOCX
# -----------------------------------
def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])


# -----------------------------------
# Generate LLM Prompt
# -----------------------------------
def build_prompt(resume_text):

    prompt = f"""
You are an AI Interview Assistant.

STEP 1: Extract structured information from the resume:
- Name
- Email
- Phone
- Summary
- Skills (as list)
- Education
- Projects
- Internships
- Work Experience
- Strengths
- Hobbies

STEP 2: Based on the extracted information, generate:
- 5 Technical Interview Questions
- 3 HR Questions
- 2 Behavioral Questions
- 1 Random Group Discussion (GD) topic that is NOT related to technical skills, programming, software, or the candidate's resume domain

Difficulty and style requirements:
- Keep all interview questions easy and beginner-friendly.
- Use simple, clear language.
- Avoid advanced or tricky wording.

Important output rules:
- Return JSON only. Do not include markdown, code fences, explanations, or extra keys.
- Follow the schema exactly.
- `skills`, `technical`, `hr`, and `behavioral` must be arrays of strings.
- `group_discussion.topic` and `group_discussion.expected_answer` must be non-empty strings.

Return ONLY valid JSON in this format:

{{
  "extracted_information": {{
      "name": "",
      "email": "",
      "phone": "",
      "summary": "",
      "skills": [],
      "education": "",
      "projects": "",
      "internships": "",
      "work_experience": "",
      "strengths": "",
      "hobbies": ""
  }},
  "interview_questions": {{
      "technical": [],
      "hr": [],
      "behavioral": []
  }},
  "group_discussion": {{
      "topic": "",
      "expected_answer": ""
  }}
}}

Resume:
{resume_text}
"""
    return prompt


# -----------------------------------
# Call HuggingFace API
# -----------------------------------
def call_llm(prompt):

    payload = {
        "model": HF_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.3,
    }

    response = requests.post(HF_API_URL, headers=HEADERS, json=payload, timeout=120)

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=response.text)

    result = response.json()
    output_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    return output_text


@router.post("/analyze-resume/")
async def analyze_resume(file: UploadFile = File(...)):

    if not HF_API_KEY:
        raise HTTPException(status_code=500, detail="HF_API_KEY not set")

    file_path = Path(f"temp_{file.filename}")

    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Extract text
    if file_path.suffix.lower() == ".pdf":
        resume_text = extract_text_from_pdf(file_path)
    elif file_path.suffix.lower() == ".docx":
        resume_text = extract_text_from_docx(file_path)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX supported")

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text")

    prompt = build_prompt(resume_text)
    llm_output = call_llm(prompt)

    parse_error = None
    try:
        parsed_json = _extract_json_object(llm_output)
    except Exception as exc:
        parsed_json = {}
        parse_error = str(exc)

    normalized_result = _normalize_result(parsed_json, resume_text)

    # -------------------------
    # Save to MongoDB
    # -------------------------
    interviews_collection = get_interviews_collection()

    document = {
        "extracted_information": normalized_result["extracted_information"],
        "interview_questions": normalized_result["interview_questions"],
        "resume_text": resume_text,
        "llm_raw_output": llm_output,
        "llm_parse_error": parse_error,
        "created_at": datetime.utcnow()
    }

    insert_result = interviews_collection.insert_one(document)

    file_path.unlink(missing_ok=True)

    return {
        "message": "Resume analyzed and saved successfully",
        "interview_id": str(insert_result.inserted_id),
        "data": normalized_result,
        "parse_error": parse_error,
    }
