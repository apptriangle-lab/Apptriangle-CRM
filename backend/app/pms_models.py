"""PMS (Project Management System) ORM models — separate from CRM Task module."""
from datetime import datetime, date

from sqlalchemy import Numeric, UniqueConstraint, Text
from app import db
from app.models import generate_id


def _dt_iso(dt):
    return dt.isoformat() + "Z" if dt else None


def _date_iso(d):
    return d.isoformat() if d else None


PROJECT_STATUSES = ("not_started", "in_progress", "on_hold", "completed", "cancelled")
PROJECT_PRIORITIES = ("low", "medium", "high", "urgent")
# Task status values: Settings → Status → PMS Task Statuses (status_config.pms_task_status)
TASK_PRIORITIES = ("low", "medium", "high", "urgent")
SPRINT_STATUSES = ("planned", "active", "completed", "cancelled")


class PmsProjectType(db.Model):
    """Project types managed in Settings → Variables (admin)."""
    __tablename__ = "pms_project_types"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(200), unique=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    projects = db.relationship("PmsProject", back_populates="project_type")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "sortOrder": self.sort_order,
            "isActive": self.is_active if self.is_active is not None else True,
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }


class PmsProject(db.Model):
    __tablename__ = "pms_projects"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    project_code = db.Column(db.String(32), nullable=False, unique=True, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(Text, default="")
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=True, index=True)
    project_type_id = db.Column(
        db.String(40), db.ForeignKey("pms_project_types.id"), nullable=True, index=True
    )
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(32), nullable=False, default="not_started", index=True)
    priority = db.Column(db.String(16), nullable=False, default="medium")
    progress = db.Column(Numeric(5, 2), nullable=False, default=0)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    updated_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = db.relationship("PmsProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = db.relationship("PmsTask", back_populates="project", cascade="all, delete-orphan")
    sprints = db.relationship("PmsSprint", back_populates="project", cascade="all, delete-orphan")
    project_type = db.relationship("PmsProjectType", back_populates="projects")

    def to_dict(self, include_member_count: bool = False, member_count: int | None = None, project_type_name: str | None = None):
        d = {
            "id": self.id,
            "projectCode": self.project_code,
            "title": self.title,
            "description": self.description or "",
            "companyId": self.company_id,
            "projectTypeId": self.project_type_id,
            "projectTypeName": project_type_name,
            "startDate": _date_iso(self.start_date),
            "endDate": _date_iso(self.end_date),
            "status": self.status,
            "priority": self.priority,
            "progress": float(self.progress) if self.progress is not None else 0,
            "createdBy": self.created_by,
            "updatedBy": self.updated_by,
            "deletedAt": _dt_iso(self.deleted_at),
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }
        if include_member_count:
            d["memberCount"] = member_count if member_count is not None else len(self.members or [])
        return d


class PmsProjectMember(db.Model):
    __tablename__ = "pms_project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_pms_project_members_project_user"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    project_id = db.Column(db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    invited_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    role_label = db.Column(db.String(64), nullable=True)
    joined_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("PmsProject", back_populates="members")

    def to_dict(self, user_name: str | None = None, user_email: str | None = None):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "userId": self.user_id,
            "userName": user_name,
            "userEmail": user_email,
            "invitedBy": self.invited_by,
            "roleLabel": self.role_label,
            "joinedAt": _dt_iso(self.joined_at),
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }


class PmsProjectStar(db.Model):
    """Per-user starred PMS projects for the projects table."""
    __tablename__ = "pms_project_stars"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_pms_project_stars_user_project"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = db.Column(
        db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship("PmsProject", backref=db.backref("stars", cascade="all, delete-orphan"))


class PmsSprint(db.Model):
    __tablename__ = "pms_sprints"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    project_id = db.Column(db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    goal = db.Column(Text, default="")
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(32), nullable=False, default="planned", index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    updated_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("PmsProject", back_populates="sprints")
    tasks = db.relationship("PmsTask", back_populates="sprint")

    def to_dict(self, task_count: int | None = None):
        d = {
            "id": self.id,
            "projectId": self.project_id,
            "name": self.name,
            "goal": self.goal or "",
            "startDate": _date_iso(self.start_date),
            "endDate": _date_iso(self.end_date),
            "status": self.status,
            "sortOrder": self.sort_order,
            "createdBy": self.created_by,
            "updatedBy": self.updated_by,
            "deletedAt": _dt_iso(self.deleted_at),
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }
        if task_count is not None:
            d["taskCount"] = task_count
        return d


class PmsTask(db.Model):
    __tablename__ = "pms_tasks"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    project_id = db.Column(db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_id = db.Column(db.String(40), db.ForeignKey("pms_sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id"), nullable=True, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(Text, default="")
    assigned_to = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True, index=True)
    assigned_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(32), nullable=False, default="to_do", index=True)
    priority = db.Column(db.String(16), nullable=False, default="medium")
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    estimated_hours = db.Column(Numeric(10, 2), nullable=True)
    actual_hours = db.Column(Numeric(10, 2), nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    updated_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("PmsProject", back_populates="tasks")
    sprint = db.relationship("PmsSprint", back_populates="tasks")
    sub_tasks = db.relationship("PmsTask", backref=db.backref("parent", remote_side=[id]))
    comments = db.relationship("PmsTaskComment", back_populates="task", cascade="all, delete-orphan")
    attachments = db.relationship("PmsTaskAttachment", back_populates="task", cascade="all, delete-orphan")
    task_assignees = db.relationship(
        "PmsTaskAssignee",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    def to_dict(
        self,
        project_title: str | None = None,
        assignee_name: str | None = None,
        sub_task_count: int | None = None,
        attachment_count: int | None = None,
    ):
        d = {
            "id": self.id,
            "projectId": self.project_id,
            "projectTitle": project_title,
            "sprintId": self.sprint_id,
            "parentTaskId": self.parent_task_id,
            "title": self.title,
            "description": self.description or "",
            "assignedTo": self.assigned_to,
            "assigneeName": assignee_name,
            "assignedBy": self.assigned_by,
            "status": self.status,
            "priority": self.priority,
            "startDate": _date_iso(self.start_date),
            "endDate": _date_iso(self.end_date),
            "estimatedHours": float(self.estimated_hours) if self.estimated_hours is not None else None,
            "actualHours": float(self.actual_hours) if self.actual_hours is not None else None,
            "completedAt": _dt_iso(self.completed_at),
            "createdBy": self.created_by,
            "updatedBy": self.updated_by,
            "deletedAt": _dt_iso(self.deleted_at),
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }
        if sub_task_count is not None:
            d["subTaskCount"] = sub_task_count
        if attachment_count is not None:
            d["attachmentCount"] = attachment_count
        return d


class PmsTaskAssignee(db.Model):
    """Many-to-many task assignees (replaces single assigned_to over time)."""

    __tablename__ = "pms_task_assignees"
    __table_args__ = (db.UniqueConstraint("task_id", "user_id", name="uq_pms_task_assignees_task_user"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    task = db.relationship("PmsTask", back_populates="task_assignees")

    def to_dict(self, user_name: str | None = None):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "userId": self.user_id,
            "userName": user_name,
            "assignedBy": self.assigned_by,
            "createdAt": _dt_iso(self.created_at),
        }


class PmsTaskActivityLog(db.Model):
    """Audit trail for PMS task lifecycle events (delete, restore, permanent delete)."""

    __tablename__ = "pms_task_activity_logs"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = db.Column(db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = db.Column(db.String(32), nullable=False, index=True)
    actor_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    details = db.Column(Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self, actor_name: str | None = None):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "projectId": self.project_id,
            "actionType": self.action_type,
            "actorUserId": self.actor_user_id,
            "actorName": actor_name,
            "details": self.details or "",
            "createdAt": _dt_iso(self.created_at),
        }


class PmsTaskComment(db.Model):
    __tablename__ = "pms_task_comments"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    comment = db.Column(Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = db.relationship("PmsTask", back_populates="comments")

    def to_dict(self, user_name: str | None = None):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "userId": self.user_id,
            "userName": user_name,
            "comment": self.comment,
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }


class PmsTaskAttachment(db.Model):
    __tablename__ = "pms_task_attachments"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(128), nullable=True)
    file_size = db.Column(db.BigInteger, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = db.relationship("PmsTask", back_populates="attachments")

    def to_dict(self, download_url: str | None = None):
        d = {
            "id": self.id,
            "taskId": self.task_id,
            "uploadedBy": self.uploaded_by,
            "fileName": self.file_name,
            "filePath": self.file_path,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }
        if download_url:
            d["downloadUrl"] = download_url
        return d


class PmsProjectAttachment(db.Model):
    """Project-level documents (not linked to a task)."""
    __tablename__ = "pms_project_attachments"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    project_id = db.Column(
        db.String(40), db.ForeignKey("pms_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(128), nullable=True)
    file_size = db.Column(db.BigInteger, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("PmsProject", backref=db.backref("project_attachments", cascade="all, delete-orphan"))

    def to_dict(self, download_url: str | None = None):
        d = {
            "id": self.id,
            "projectId": self.project_id,
            "uploadedBy": self.uploaded_by,
            "fileName": self.file_name,
            "filePath": self.file_path,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
            "source": "project",
        }
        if download_url:
            d["downloadUrl"] = download_url
        return d


class PmsTaskDependency(db.Model):
    __tablename__ = "pms_task_dependencies"
    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_pms_task_dependencies_pair"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    depends_on_task_id = db.Column(db.String(40), db.ForeignKey("pms_tasks.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "dependsOnTaskId": self.depends_on_task_id,
            "createdAt": _dt_iso(self.created_at),
            "updatedAt": _dt_iso(self.updated_at),
        }
