-- PMS (Project Management System) tables — optional manual run if not using SQLAlchemy create_all.

CREATE TABLE IF NOT EXISTS pms_projects (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    project_code VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    company_id VARCHAR(40) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'not_started',
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    progress DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_by VARCHAR(40) NOT NULL,
    updated_by VARCHAR(40) NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uq_pms_projects_code UNIQUE (project_code),
    CONSTRAINT fk_pms_projects_company FOREIGN KEY (company_id) REFERENCES companies (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pms_projects_created_by FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pms_projects_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_pms_projects_status ON pms_projects (status);
CREATE INDEX IF NOT EXISTS ix_pms_projects_deleted_at ON pms_projects (deleted_at);

CREATE TABLE IF NOT EXISTS pms_project_members (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    project_id VARCHAR(40) NOT NULL,
    user_id VARCHAR(40) NOT NULL,
    invited_by VARCHAR(40) NULL,
    role_label VARCHAR(64) NULL,
    joined_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uq_pms_project_members_project_user UNIQUE (project_id, user_id),
    CONSTRAINT fk_pms_project_members_project FOREIGN KEY (project_id) REFERENCES pms_projects (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_project_members_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_project_members_invited_by FOREIGN KEY (invited_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pms_tasks (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    project_id VARCHAR(40) NOT NULL,
    parent_task_id VARCHAR(40) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    assigned_to VARCHAR(40) NULL,
    assigned_by VARCHAR(40) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'to_do',
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    start_date DATE NULL,
    due_date DATE NULL,
    estimated_hours DECIMAL(10,2) NULL,
    actual_hours DECIMAL(10,2) NULL,
    completed_at DATETIME NULL,
    created_by VARCHAR(40) NOT NULL,
    updated_by VARCHAR(40) NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_pms_tasks_project FOREIGN KEY (project_id) REFERENCES pms_projects (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pms_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pms_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pms_tasks_created_by FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pms_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_pms_tasks_project_id ON pms_tasks (project_id);
CREATE INDEX IF NOT EXISTS ix_pms_tasks_assigned_to ON pms_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS ix_pms_tasks_status ON pms_tasks (status);
CREATE INDEX IF NOT EXISTS ix_pms_tasks_deleted_at ON pms_tasks (deleted_at);

CREATE TABLE IF NOT EXISTS pms_task_comments (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    task_id VARCHAR(40) NOT NULL,
    user_id VARCHAR(40) NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_pms_task_comments_task FOREIGN KEY (task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_task_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pms_task_attachments (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    task_id VARCHAR(40) NOT NULL,
    uploaded_by VARCHAR(40) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(128) NULL,
    file_size BIGINT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_pms_task_attachments_task FOREIGN KEY (task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_task_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pms_task_dependencies (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    task_id VARCHAR(40) NOT NULL,
    depends_on_task_id VARCHAR(40) NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uq_pms_task_dependencies_pair UNIQUE (task_id, depends_on_task_id),
    CONSTRAINT fk_pms_task_dependencies_task FOREIGN KEY (task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_task_dependencies_depends FOREIGN KEY (depends_on_task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
