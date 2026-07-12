-- CRM Backend - MySQL-compatible schema for import (phpMyAdmin)
-- Uses InnoDB for foreign keys

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS sales_activities;
DROP TABLE IF EXISTS sales_status_logs;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS task_activity_logs;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS status_config;
DROP TABLE IF EXISTS company_profile;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    role VARCHAR(20) DEFAULT 'user',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Optional, because UNIQUE already creates an index)
-- CREATE INDEX ix_users_email ON users(email);


-- =========================
-- COMPANIES
-- =========================
CREATE TABLE companies (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) DEFAULT '',
    country VARCHAR(100) DEFAULT '',
    kam_user_id VARCHAR(40) NULL,
    created_by_user_id VARCHAR(40) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX ix_companies_kam_user_id (kam_user_id),
    INDEX ix_companies_created_by_user_id (created_by_user_id),

    CONSTRAINT fk_companies_kam_user
        FOREIGN KEY (kam_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_companies_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- CONTACTS
-- =========================
CREATE TABLE contacts (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_id VARCHAR(40) NOT NULL,
    designation VARCHAR(100),
    mobile VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_contacts_company_id (company_id),

    CONSTRAINT fk_contacts_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- TASKS
-- =========================
CREATE TABLE tasks (
    id VARCHAR(40) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    note TEXT,
    company_id VARCHAR(40) NOT NULL,
    due_datetime DATETIME NOT NULL,
    assign_by_user_id VARCHAR(40) NULL,
    assign_to_user_id VARCHAR(40) NULL,
    status VARCHAR(30) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_tasks_company_id (company_id),
    INDEX ix_tasks_assign_by_user_id (assign_by_user_id),
    INDEX ix_tasks_assign_to_user_id (assign_to_user_id),
    INDEX ix_tasks_status (status),
    INDEX ix_tasks_due_datetime (due_datetime),

    CONSTRAINT fk_tasks_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_tasks_assign_by
        FOREIGN KEY (assign_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_tasks_assign_to
        FOREIGN KEY (assign_to_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- TASK ACTIVITY LOGS
-- =========================
CREATE TABLE task_activity_logs (
    id VARCHAR(40) PRIMARY KEY,
    task_id VARCHAR(40) NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    note TEXT,
    actor_user_id VARCHAR(40) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_task_logs_task_id (task_id),
    INDEX ix_task_logs_actor_user_id (actor_user_id),
    INDEX ix_task_logs_action_type (action_type),

    CONSTRAINT fk_task_logs_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_task_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- SALES
-- =========================
CREATE TABLE sales (
    id VARCHAR(40) PRIMARY KEY,
    company_id VARCHAR(40) NOT NULL,
    category VARCHAR(20) DEFAULT 'cold',
    prospect VARCHAR(255) NOT NULL,
    expected_closing_date DATE NOT NULL,
    expected_revenue DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'lead',
    created_by_user_id VARCHAR(40) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_sales_company_id (company_id),
    INDEX ix_sales_created_by_user_id (created_by_user_id),
    INDEX ix_sales_status (status),
    INDEX ix_sales_expected_closing_date (expected_closing_date),

    CONSTRAINT fk_sales_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_sales_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- SALES STATUS LOGS
-- =========================
CREATE TABLE sales_status_logs (
    id VARCHAR(40) PRIMARY KEY,
    sales_id VARCHAR(40) NOT NULL,
    from_status VARCHAR(30) NOT NULL,
    to_status VARCHAR(30) NOT NULL,
    note TEXT NOT NULL,
    changed_by_user_id VARCHAR(40) NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_sales_status_logs_sales_id (sales_id),
    INDEX ix_sales_status_logs_changed_by (changed_by_user_id),

    CONSTRAINT fk_sales_status_logs_sales
        FOREIGN KEY (sales_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_sales_status_logs_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================
-- SALES ACTIVITIES
-- =========================
CREATE TABLE sales_activities (
    id VARCHAR(40) PRIMARY KEY,
    sales_id VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    note TEXT NOT NULL,
    date DATE NOT NULL,
    created_by_user_id VARCHAR(40) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_sales_activities_sales_id (sales_id),
    INDEX ix_sales_activities_created_by (created_by_user_id),
    INDEX ix_sales_activities_date (date),

    CONSTRAINT fk_sales_activities_sales
        FOREIGN KEY (sales_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_sales_activities_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- STATUS CONFIG (task statuses, sales categories, sales statuses)
-- =========================
CREATE TABLE status_config (
    id VARCHAR(40) PRIMARY KEY,
    `group` VARCHAR(30) NOT NULL,
    value VARCHAR(60) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    INDEX ix_status_config_group (`group`),
    UNIQUE KEY uq_status_config_group_value (`group`, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- COMPANY PROFILE (Settings > Company - single row)
-- =========================
CREATE TABLE company_profile (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    address VARCHAR(255) DEFAULT '',
    city VARCHAR(100) DEFAULT '',
    country VARCHAR(100) DEFAULT '',
    industry VARCHAR(100) DEFAULT '',
    tax_id VARCHAR(50) DEFAULT '',
    description TEXT,
    logo MEDIUMTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
