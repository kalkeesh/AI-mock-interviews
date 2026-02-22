import pdfplumber
import docx
import re
import json
from pathlib import Path


# -----------------------------------
# 1️⃣ Extract Text from PDF
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
# 2️⃣ Extract Text from DOCX
# -----------------------------------
def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])


# -----------------------------------
# 3️⃣ Extract Basic Details
# -----------------------------------
def extract_basic_details(text):

    email = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    phone = re.findall(r"\+?\d[\d\s-]{8,}\d", text)

    # Assume first non-empty line is name
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    name = lines[0] if lines else None

    return {
        "name": name,
        "email": email[0] if email else None,
        "phone": phone[0] if phone else None
    }


# -----------------------------------
# 4️⃣ Section-Based Parsing
# -----------------------------------
def extract_sections(text):

    section_keywords = {
        "profile": ["profile", "personal details"],
        "summary": ["summary", "objective"],
        "skills": ["skills", "technical skills"],
        "education": ["education", "academic background"],
        "projects": ["projects"],
        "internships": ["internship", "internships"],
        "work_experience": ["work experience", "experience", "professional experience"],
        "advantages": ["strengths", "advantages"],
        "hobbies": ["hobbies", "interests"]
    }

    lines = text.split("\n")
    structured_data = {key: [] for key in section_keywords.keys()}
    current_section = None

    for line in lines:
        clean_line = line.strip()
        if not clean_line:
            continue

        lower_line = clean_line.lower()

        # Detect section header
        for section, keywords in section_keywords.items():
            if any(keyword in lower_line for keyword in keywords):
                current_section = section
                break

        # Append content
        if current_section:
            structured_data[current_section].append(clean_line)

    # Convert list to string
    for key in structured_data:
        structured_data[key] = "\n".join(structured_data[key]).strip()

    return structured_data


# -----------------------------------
# 5️⃣ Master Resume Parser
# -----------------------------------
def parse_resume(file_path):

    file_path = Path(file_path)

    if file_path.suffix.lower() == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif file_path.suffix.lower() == ".docx":
        text = extract_text_from_docx(file_path)
    else:
        raise ValueError("Unsupported file format. Use PDF or DOCX.")

    basic_details = extract_basic_details(text)
    sections = extract_sections(text)

    result = {
        "basic_details": basic_details,
        "summary": sections.get("summary"),
        "profile": sections.get("profile"),
        "skills": sections.get("skills"),
        "education": sections.get("education"),
        "projects": sections.get("projects"),
        "internships": sections.get("internships"),
        "work_experience": sections.get("work_experience"),
        "advantages": sections.get("advantages"),
        "hobbies": sections.get("hobbies"),
        "full_text": text
    }

    return result


# -----------------------------------
# 6️⃣ Run + Save JSON
# -----------------------------------
if __name__ == "__main__":

    file_path = "cv_kalki.pdf"  # change to your resume file

    parsed_data = parse_resume(file_path)

    # Save result to result.json
    with open("result.json", "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, indent=4, ensure_ascii=False)

    print("✅ Resume parsed successfully!")
    print("📁 Output saved to result.json")