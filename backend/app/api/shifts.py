from flask import Blueprint, request, jsonify
from app import db
from app.models import Shift, HRInfo
from app.auth_utils import require_auth, require_admin_or_hr_access
from app.notification_service import notification_service
from datetime import datetime

shifts_bp = Blueprint("shifts", __name__)

@shifts_bp.route("", methods=["GET"])
@require_auth
def list_shifts(current_user):
    shifts = Shift.query.all()
    return jsonify([s.to_dict() for s in shifts])

@shifts_bp.route("", methods=["POST"])
@require_admin_or_hr_access
def create_shift(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    name = data.get("name")
    start_time = data.get("startTime")
    end_time = data.get("endTime")
    weekend_days = data.get("weekendDays")
    grace_period = data.get("gracePeriod", 0)
    employee_ids = data.get("employeeIds", [])
    
    if not all([name, start_time, end_time, weekend_days is not None]):
        return jsonify({"error": "Missing required fields"}), 400
    
    shift = Shift(
        name=name,
        start_time=start_time,
        end_time=end_time,
        weekend_days=weekend_days,
        grace_period=grace_period
    )
    db.session.add(shift)
    db.session.flush() # Get shift ID before commit

    # Assign employees if provided
    if employee_ids:
        # Get existing HRInfo records
        existing_hr_infos = HRInfo.query.filter(HRInfo.user_id.in_(employee_ids)).all()
        existing_user_ids = {info.user_id for info in existing_hr_infos}
        
        # Update existing
        for info in existing_hr_infos:
            info.shift_id = shift.id
            
        # Create missing HRInfo records for users who don't have one yet
        missing_user_ids = set(employee_ids) - existing_user_ids
        for user_id in missing_user_ids:
            new_info = HRInfo(user_id=user_id, shift_id=shift.id)
            db.session.add(new_info)
    
    db.session.commit()
    return jsonify(shift.to_dict()), 201

@shifts_bp.route("/<shift_id>", methods=["PUT"])
@require_admin_or_hr_access
def update_shift(current_user, shift_id):
    shift = Shift.query.get_or_404(shift_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    shift.name = data.get("name", shift.name)
    shift.start_time = data.get("startTime", shift.start_time)
    shift.end_time = data.get("endTime", shift.end_time)
    shift.weekend_days = data.get("weekendDays", shift.weekend_days)
    shift.grace_period = data.get("gracePeriod", shift.grace_period)
    
    employee_ids = data.get("employeeIds")
    if employee_ids is not None:
        # Remove existing employees from this shift
        HRInfo.query.filter_by(shift_id=shift_id).update({HRInfo.shift_id: None}, synchronize_session=False)
        # Assign new set of employees
        if employee_ids:
            # Get existing HRInfo records
            existing_hr_infos = HRInfo.query.filter(HRInfo.user_id.in_(employee_ids)).all()
            existing_user_ids = {info.user_id for info in existing_hr_infos}
            
            # Update existing
            for info in existing_hr_infos:
                info.shift_id = shift_id
                
            # Create missing HRInfo records
            missing_user_ids = set(employee_ids) - existing_user_ids
            for user_id in missing_user_ids:
                new_info = HRInfo(user_id=user_id, shift_id=shift_id)
                db.session.add(new_info)

    db.session.commit()
    return jsonify(shift.to_dict())

@shifts_bp.route("/<shift_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_shift(current_user, shift_id):
    shift = Shift.query.get_or_404(shift_id)
    shift_name = shift.name
    assigned = HRInfo.query.filter_by(shift_id=shift_id).all()
    for hr in assigned:
        notification_service.create_notification(
            user_id=hr.user_id,
            title="Shift Removed",
            message=(
                f'The shift "{shift_name}" was deleted. '
                "You are no longer assigned to it."
            ),
            n_type="warning",
            category="hr",
        )
    HRInfo.query.filter_by(shift_id=shift_id).update(
        {HRInfo.shift_id: None}, synchronize_session=False
    )
    db.session.delete(shift)
    db.session.commit()
    return jsonify({"message": "Shift deleted successfully"})

@shifts_bp.route("/assign", methods=["POST"])
@require_admin_or_hr_access
def assign_shift(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = data.get("userId")
    shift_id = data.get("shiftId")
    
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
        
    hr_info = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr_info:
        # Create a new HRInfo record if it doesn't exist
        hr_info = HRInfo(user_id=user_id)
        db.session.add(hr_info)
        
    if shift_id:
        shift = Shift.query.get(shift_id)
        if not shift:
            return jsonify({"error": "Shift not found"}), 404
        hr_info.shift_id = shift_id
        # Trigger notification
        notification_service.create_notification(
            user_id=user_id,
            title="New Shift Assigned",
            message=f"You have been assigned to the shift: {shift.name}",
            n_type="info",
            category="hr",
        )
    else:
        hr_info.shift_id = None
        # Trigger notification
        notification_service.create_notification(
            user_id=user_id,
            title="Shift Removed",
            message="You have been removed from your current shift.",
            n_type="warning",
            category="hr",
        )
        
    db.session.commit()
    return jsonify({"message": "Shift assigned successfully"})
