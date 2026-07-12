-- Many assignees per PMS task. Backfill from pms_tasks.assigned_to on first app start.

CREATE TABLE IF NOT EXISTS pms_task_assignees (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    task_id VARCHAR(40) NOT NULL,
    user_id VARCHAR(40) NOT NULL,
    assigned_by VARCHAR(40) NULL,
    created_at DATETIME NULL,
    CONSTRAINT uq_pms_task_assignees_task_user UNIQUE (task_id, user_id),
    CONSTRAINT fk_pms_task_assignees_task FOREIGN KEY (task_id) REFERENCES pms_tasks (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_task_assignees_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pms_task_assignees_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_pms_task_assignees_task_id ON pms_task_assignees (task_id);
CREATE INDEX IF NOT EXISTS ix_pms_task_assignees_user_id ON pms_task_assignees (user_id);
