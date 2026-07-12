from flask import Blueprint, request, jsonify
from app.auth_utils import require_auth
from app.notification_service import notification_service

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.route("", methods=["GET"])
@require_auth
def get_notifications(current_user):
    """
    Get notifications for the current logged-in user.
    """
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    
    notifications = notification_service.get_user_notifications(current_user.id, limit, offset)
    unread_count = notification_service.get_unread_count(current_user.id)
    
    return jsonify({
        "notifications": [n.to_dict() for n in notifications],
        "unreadCount": unread_count
    })

@notifications_bp.route("/<notification_id>/read", methods=["PATCH"])
@require_auth
def mark_as_read(current_user, notification_id):
    """
    Mark a specific notification as read.
    """
    success = notification_service.mark_as_read(notification_id, current_user.id)
    if success:
        return jsonify({"message": "Notification marked as read"})
    return jsonify({"error": "Notification not found"}), 404

@notifications_bp.route("/read-all", methods=["PATCH"])
@require_auth
def mark_all_read(current_user):
    """
    Mark all notifications as read for the current user.
    """
    notification_service.mark_all_as_read(current_user.id)
    return jsonify({"message": "All notifications marked as read"})

@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@require_auth
def delete_notification(current_user, notification_id):
    """
    Delete a specific notification.
    """
    success = notification_service.delete_notification(notification_id, current_user.id)
    if success:
        return jsonify({"message": "Notification deleted"})
    return jsonify({"error": "Notification not found"}), 404
