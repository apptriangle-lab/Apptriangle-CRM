-- PMS sprints and task sprint assignment

CREATE TABLE IF NOT EXISTS pms_sprints (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    project_id VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    goal TEXT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'planned',
    sort_order INT NOT NULL DEFAULT 0,
    created_by VARCHAR(40) NOT NULL,
    updated_by VARCHAR(40) NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_pms_sprints_project FOREIGN KEY (project_id) REFERENCES pms_projects (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_sprints_created_by FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pms_sprints_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_pms_sprints_project_id ON pms_sprints (project_id);
CREATE INDEX IF NOT EXISTS ix_pms_sprints_status ON pms_sprints (status);
CREATE INDEX IF NOT EXISTS ix_pms_sprints_deleted_at ON pms_sprints (deleted_at);

-- SQLite / MySQL: add column if missing (safe for dev create_all; run manually on existing DBs)
ALTER TABLE pms_tasks ADD COLUMN sprint_id VARCHAR(40) NULL;
CREATE INDEX IF NOT EXISTS ix_pms_tasks_sprint_id ON pms_tasks (sprint_id);
