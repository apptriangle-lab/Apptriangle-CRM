-- RBAC foundation tables (optional manual run if not using SQLAlchemy create_all).

CREATE TABLE IF NOT EXISTS user_page_permissions (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL,
    page_key VARCHAR(64) NOT NULL,
    access_type VARCHAR(20) NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uq_user_page_permissions_user_page UNIQUE (user_id, page_key),
    CONSTRAINT fk_user_page_permissions_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_page_defaults (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    page_key VARCHAR(64) NOT NULL,
    access_type VARCHAR(20) NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uq_role_page_defaults_role_page UNIQUE (role, page_key)
);
