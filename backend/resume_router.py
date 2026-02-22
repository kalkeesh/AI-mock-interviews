import os
import json
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


# -----------------------------------
# Main Endpoint
# -----------------------------------
# @router.post("/analyze-resume/")
# async def analyze_resume(file: UploadFile = File(...)):

#     if not HF_API_KEY:
#         raise HTTPException(status_code=500, detail="HF_API_KEY not set")

#     file_path = Path(f"temp_{file.filename}")

#     with open(file_path, "wb") as f:
#         f.write(await file.read())

#     # Extract text
#     if file_path.suffix.lower() == ".pdf":
#         resume_text = extract_text_from_pdf(file_path)
#     elif file_path.suffix.lower() == ".docx":
#         resume_text = extract_text_from_docx(file_path)
#     else:
#         raise HTTPException(status_code=400, detail="Only PDF and DOCX supported")

#     if not resume_text.strip():
#         raise HTTPException(status_code=400, detail="Could not extract text")

#     prompt = build_prompt(resume_text)

#     llm_output = call_llm(prompt)

#     # Try parsing JSON safely
#     try:
#         parsed_json = json.loads(llm_output)
#     except:
#         parsed_json = {
#             "raw_output": llm_output,
#             "error": "Model did not return valid JSON"
#         }

#     file_path.unlink(missing_ok=True)

#     return parsed_json
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

    try:
        parsed_json = json.loads(llm_output)
    except:
        parsed_json = {
            "raw_output": llm_output,
            "error": "Model did not return valid JSON"
        }

    # -------------------------
    # Save to MongoDB
    # -------------------------
    interviews_collection = get_interviews_collection()

    document = {
        "extracted_information": parsed_json.get("extracted_information"),
        "interview_questions": parsed_json.get("interview_questions"),
        "resume_text": resume_text,
        "created_at": datetime.utcnow()
    }

    insert_result = interviews_collection.insert_one(document)

    file_path.unlink(missing_ok=True)

    return {
        "message": "Resume analyzed and saved successfully",
        "interview_id": str(insert_result.inserted_id),
        "data": parsed_json
    }
