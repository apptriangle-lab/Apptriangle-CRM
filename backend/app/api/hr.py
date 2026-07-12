"""HR API: get, create/update HR info, manage employment history and academic certifications."""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models import HRInfo, EmploymentHistory, AcademicCertification, EmergencyContact, User
from app.auth_utils import require_admin_or_hr_access
from app.services.hr_employee_service import (
    DEFAULT_PER_PAGE,
    list_employees_lookup,
    list_employees_paginated,
)

hr_bp = Blueprint("hr", __name__)


def _parse_date(s):
    """Parse ISO date string to date object."""
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        return date.fromisoformat(s)
    except Exception:
        return None


@hr_bp.route("/employees", methods=["GET"])
@require_admin_or_hr_access
def list_employees(current_user):
    """
    Paginated employee directory for HR Profiles tab.
    Query: page, perPage, search, department, designation, role.
    """
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("perPage", DEFAULT_PER_PAGE, type=int)
    search = request.args.get("search") or ""
    department = request.args.get("department") or ""
    designation = request.args.get("designation") or ""
    role = request.args.get("role") or ""
    payload = list_employees_paginated(
        page=page,
        per_page=per_page,
        search=search,
        department=department,
        designation=designation,
        role=role,
    )
    return jsonify(payload), 200


@hr_bp.route("/employees/lookup", methods=["GET"])
@require_admin_or_hr_access
def employees_lookup(current_user):
    """All users + minimal HR fields (no profile blobs, no nested history). For attendance/shifts/filters."""
    return jsonify(list_employees_lookup()), 200


@hr_bp.route("/info/<user_id>", methods=["GET"])
@require_admin_or_hr_access
def get_hr_info(user_id, current_user):
    """Admin only. Get HR info for a user."""
    # Get user info first
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    hr_info = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr_info:
        return jsonify({"error": "HR info not found"}), 404
    
    # Get related data
    employment_history = EmploymentHistory.query.filter_by(hr_info_id=hr_info.id).order_by(EmploymentHistory.appraisal_date.desc()).all()
    academic_certifications = AcademicCertification.query.filter_by(hr_info_id=hr_info.id).order_by(AcademicCertification.year.desc()).all()
    emergency_contacts = EmergencyContact.query.filter_by(hr_info_id=hr_info.id).order_by(EmergencyContact.created_at.desc()).all()
    
    result = hr_info.to_dict()
    # Override with user data (name, email, phone come from user table)
    result["name"] = user.name
    result["email"] = user.email
    result["phone"] = user.phone or ""
    result["employmentHistory"] = [e.to_dict() for e in employment_history]
    result["academicCertifications"] = [a.to_dict() for a in academic_certifications]
    result["emergencyContacts"] = [ec.to_dict() for ec in emergency_contacts]
    
    return jsonify(result), 200


@hr_bp.route("/info/<user_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_hr_info(user_id, current_user):
    """Admin only. Create or update HR info for a user."""
    # Verify user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json() or {}
    
    # Get or create HR info
    hr_info = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr_info:
        hr_info = HRInfo(user_id=user_id)
        db.session.add(hr_info)
    
    # Update fields (name, email, phone are NOT stored in HR table, they come from User table)
    if "birthDate" in data:
        hr_info.birth_date = _parse_date(data.get("birthDate"))
    if "nid" in data:
        hr_info.nid = (data.get("nid") or "").strip()[:100]
    if "department" in data:
        hr_info.department = (data.get("department") or "").strip()[:200]
    if "designation" in data:
        hr_info.designation = (data.get("designation") or "").strip()[:200]
    if "religion" in data:
        hr_info.religion = (data.get("religion") or "").strip()[:100]
    if "bloodGroup" in data:
        hr_info.blood_group = (data.get("bloodGroup") or "").strip()[:10]
    if "officeMail" in data:
        hr_info.office_mail = (data.get("officeMail") or "").strip()[:255]
    if "personalMail" in data:
        hr_info.personal_mail = (data.get("personalMail") or "").strip()[:255]
    if "maritalStatus" in data:
        hr_info.marital_status = (data.get("maritalStatus") or "").strip()[:50]
    if "gender" in data:
        hr_info.gender = (data.get("gender") or "").strip()[:50]
    if "employeeType" in data:
        hr_info.employee_type = (data.get("employeeType") or "").strip()[:50]
    if "joiningDate" in data:
        hr_info.joining_date = _parse_date(data.get("joiningDate"))
    if "reportingManagerId" in data:
        manager_id = (data.get("reportingManagerId") or "").strip() or None
        if manager_id:
            # Verify manager exists
            manager = User.query.get(manager_id)
            if not manager:
                return jsonify({"error": "Reporting manager not found"}), 400
        hr_info.reporting_manager_id = manager_id
    if "presentAddress" in data:
        hr_info.present_address = (data.get("presentAddress") or "").strip()
    if "permanentAddress" in data:
        hr_info.permanent_address = (data.get("permanentAddress") or "").strip()
    # Note: name, email, phone are NOT updated here - they come from User table
    # mobile can be different from phone, so we keep it
    if "mobile" in data:
        hr_info.mobile = (data.get("mobile") or "").strip()[:50]
    if "employeeId" in data:
        hr_info.employee_id = (data.get("employeeId") or "").strip()[:100]
    if "profilePicture" in data:
        hr_info.profile_picture = data.get("profilePicture")  # base64 data URL or null
    if "bankRoutingNumber" in data:
        hr_info.bank_routing_number = (data.get("bankRoutingNumber") or "").strip()[:100]
    if "beneficiaryBankAccountNumber" in data:
        hr_info.beneficiary_bank_account_number = (
            (data.get("beneficiaryBankAccountNumber") or "").strip()[:100]
        )
    if "receiverName" in data:
        hr_info.receiver_name = (data.get("receiverName") or "").strip()[:255]

    db.session.commit()
    
    # Return updated info with related data
    employment_history = EmploymentHistory.query.filter_by(hr_info_id=hr_info.id).order_by(EmploymentHistory.appraisal_date.desc()).all()
    academic_certifications = AcademicCertification.query.filter_by(hr_info_id=hr_info.id).order_by(AcademicCertification.year.desc()).all()
    emergency_contacts = EmergencyContact.query.filter_by(hr_info_id=hr_info.id).order_by(EmergencyContact.created_at.desc()).all()
    
    result = hr_info.to_dict()
    # Override with user data (name, email, phone come from user table)
    result["name"] = user.name
    result["email"] = user.email
    result["phone"] = user.phone or ""
    result["employmentHistory"] = [e.to_dict() for e in employment_history]
    result["academicCertifications"] = [a.to_dict() for a in academic_certifications]
    result["emergencyContacts"] = [ec.to_dict() for ec in emergency_contacts]
    
    return jsonify(result), 200


@hr_bp.route("/employment-history", methods=["POST"])
@require_admin_or_hr_access
def create_employment_history(current_user):
    """Admin only. Create employment history entry."""
    data = request.get_json() or {}
    hr_info_id = (data.get("hrInfoId") or "").strip()
    
    if not hr_info_id:
        return jsonify({"error": "hrInfoId is required"}), 400
    
    hr_info = HRInfo.query.get(hr_info_id)
    if not hr_info:
        return jsonify({"error": "HR info not found"}), 404
    
    entry = EmploymentHistory(
        hr_info_id=hr_info_id,
        activity=(data.get("activity") or "").strip()[:255],
        appraisal_date=_parse_date(data.get("appraisalDate")),
        next_activity=(data.get("nextActivity") or "").strip()[:255],
        next_activity_date=_parse_date(data.get("nextActivityDate")),
        remarks=(data.get("remarks") or "").strip(),
    )
    db.session.add(entry)
    db.session.commit()
    
    return jsonify(entry.to_dict()), 201


@hr_bp.route("/employment-history/<entry_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_employment_history(entry_id, current_user):
    """Admin only. Update employment history entry."""
    entry = EmploymentHistory.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Employment history entry not found"}), 404
    
    data = request.get_json() or {}
    if "activity" in data:
        entry.activity = (data.get("activity") or "").strip()[:255]
    if "appraisalDate" in data:
        entry.appraisal_date = _parse_date(data.get("appraisalDate"))
    if "nextActivity" in data:
        entry.next_activity = (data.get("nextActivity") or "").strip()[:255]
    if "nextActivityDate" in data:
        entry.next_activity_date = _parse_date(data.get("nextActivityDate"))
    if "remarks" in data:
        entry.remarks = (data.get("remarks") or "").strip()
    
    db.session.commit()
    return jsonify(entry.to_dict()), 200


@hr_bp.route("/employment-history/<entry_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_employment_history(entry_id, current_user):
    """Admin only. Delete employment history entry."""
    entry = EmploymentHistory.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Employment history entry not found"}), 404
    
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200


@hr_bp.route("/academic-certification", methods=["POST"])
@require_admin_or_hr_access
def create_academic_certification(current_user):
    """Admin only. Create academic certification entry."""
    data = request.get_json() or {}
    hr_info_id = (data.get("hrInfoId") or "").strip()
    
    if not hr_info_id:
        return jsonify({"error": "hrInfoId is required"}), 400
    
    hr_info = HRInfo.query.get(hr_info_id)
    if not hr_info:
        return jsonify({"error": "HR info not found"}), 404
    
    attachment_filename = (data.get("attachmentFileName") or "").strip()[:255]
    attachment_data = data.get("attachmentData") or ""  # base64 string, can be large
    
    # If attachment_data is a data URL (starts with "data:"), we can keep it as is
    # The frontend sends it as data URL for easy display/download
    
    try:
        entry = AcademicCertification(
            hr_info_id=hr_info_id,
            degree=(data.get("degree") or "").strip()[:255],
            institute=(data.get("institute") or "").strip()[:255],
            grade=(data.get("grade") or "").strip()[:100],
            year=(data.get("year") or "").strip()[:50],
            attachment_filename=attachment_filename,
            attachment_data=attachment_data,
        )
        db.session.add(entry)
        db.session.commit()
        
        return jsonify(entry.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating academic certification: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create academic certification: {str(e)}"}), 500


@hr_bp.route("/academic-certification/<entry_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_academic_certification(entry_id, current_user):
    """Admin only. Update academic certification entry."""
    entry = AcademicCertification.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Academic certification entry not found"}), 404
    
    data = request.get_json() or {}
    try:
        if "degree" in data:
            entry.degree = (data.get("degree") or "").strip()[:255]
        if "institute" in data:
            entry.institute = (data.get("institute") or "").strip()[:255]
        if "grade" in data:
            entry.grade = (data.get("grade") or "").strip()[:100]
        if "year" in data:
            entry.year = (data.get("year") or "").strip()[:50]
        if "attachmentFileName" in data:
            entry.attachment_filename = (data.get("attachmentFileName") or "").strip()[:255]
        if "attachmentData" in data:
            entry.attachment_data = data.get("attachmentData") or ""
        
        db.session.commit()
        return jsonify(entry.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating academic certification: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update academic certification: {str(e)}"}), 500


@hr_bp.route("/academic-certification/<entry_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_academic_certification(entry_id, current_user):
    """Admin only. Delete academic certification entry."""
    entry = AcademicCertification.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Academic certification entry not found"}), 404
    
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200


@hr_bp.route("/emergency-contact", methods=["POST"])
@require_admin_or_hr_access
def create_emergency_contact(current_user):
    """Admin only. Create emergency contact entry."""
    data = request.get_json() or {}
    hr_info_id = (data.get("hrInfoId") or "").strip()
    
    if not hr_info_id:
        return jsonify({"error": "hrInfoId is required"}), 400
    
    hr_info = HRInfo.query.get(hr_info_id)
    if not hr_info:
        return jsonify({"error": "HR info not found"}), 404
    
    entry = EmergencyContact(
        hr_info_id=hr_info_id,
        name=(data.get("name") or "").strip()[:255],
        phone=(data.get("phone") or "").strip()[:50],
        relation=(data.get("relation") or "").strip()[:100],
        address=(data.get("address") or "").strip(),
    )
    db.session.add(entry)
    db.session.commit()
    
    return jsonify(entry.to_dict()), 201


@hr_bp.route("/emergency-contact/<entry_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_emergency_contact(entry_id, current_user):
    """Admin only. Update emergency contact entry."""
    entry = EmergencyContact.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Emergency contact entry not found"}), 404
    
    data = request.get_json() or {}
    try:
        if "name" in data:
            entry.name = (data.get("name") or "").strip()[:255]
        if "phone" in data:
            entry.phone = (data.get("phone") or "").strip()[:50]
        if "relation" in data:
            entry.relation = (data.get("relation") or "").strip()[:100]
        if "address" in data:
            entry.address = (data.get("address") or "").strip()
        
        db.session.commit()
        return jsonify(entry.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating emergency contact: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update emergency contact: {str(e)}"}), 500


@hr_bp.route("/emergency-contact/<entry_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_emergency_contact(entry_id, current_user):
    """Admin only. Delete emergency contact entry."""
    entry = EmergencyContact.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Emergency contact entry not found"}), 404
    
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200
