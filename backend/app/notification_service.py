from app import db
from app.models import Notification

class NotificationService:
    @staticmethod
    def create_notification(user_id, title, message, n_type="info", category="system"):
        """
        Creates a new notification for a specific user.
        """
        try:
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                type=n_type,
                category=(category or "system").strip()[:30] or "system",
            )
            db.session.add(notification)
            db.session.commit()
            return notification
        except Exception as e:
            db.session.rollback()
            print(f"Error creating notification: {e}")
            return None

    @staticmethod
    def create_notifications_bulk(items: list[dict]) -> int:
        """Create many notifications in one transaction."""
        if not items:
            return 0
        try:
            for item in items:
                db.session.add(
                    Notification(
                        user_id=item["user_id"],
                        title=item["title"],
                        message=item["message"],
                        type=item.get("n_type", "info"),
                        category=(item.get("category") or "system").strip()[:30] or "system",
                    )
                )
            db.session.commit()
            return len(items)
        except Exception as e:
            db.session.rollback()
            print(f"Error creating bulk notifications: {e}")
            return 0

    @staticmethod
    def get_user_notifications(user_id, limit=50, offset=0):
        """
        Fetches notifications for a specific user, sorted by newest first.
        """
        return Notification.query.filter_by(user_id=user_id)\
            .order_by(Notification.created_at.desc())\
            .limit(limit).offset(offset).all()

    @staticmethod
    def get_unread_count(user_id):
        """
        Returns the count of unread notifications for a user.
        """
        return Notification.query.filter_by(user_id=user_id, is_read=False).count()

    @staticmethod
    def mark_as_read(notification_id, user_id):
        """
        Marks a specific notification as read.
        """
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notification:
            notification.is_read = True
            db.session.commit()
            return True
        return False

    @staticmethod
    def mark_all_as_read(user_id):
        """
        Marks all notifications for a user as read.
        """
        Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
        db.session.commit()
        return True

    @staticmethod
    def delete_notification(notification_id, user_id):
        """
        Deletes a specific notification.
        """
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notification:
            db.session.delete(notification)
            db.session.commit()
            return True
        return False

notification_service = NotificationService()
