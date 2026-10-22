-- TaskNest uses a private schema; access runs through the authenticated Go API.

CREATE SCHEMA IF NOT EXISTS tasknest;

REVOKE ALL ON SCHEMA tasknest FROM PUBLIC;

-- A shared sequence preserves globally distinct marketplace and workspace task IDs.

CREATE SEQUENCE IF NOT EXISTS tasknest.entity_id_seq AS BIGINT;

CREATE TABLE IF NOT EXISTS tasknest.users (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    uid VARCHAR(128) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    photo_url TEXT,
    provider VARCHAR(32) NOT NULL DEFAULT 'password',
    password TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token TEXT,
    verification_token_expires TIMESTAMPTZ,
    verification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    field VARCHAR(255),
    college_name VARCHAR(255),
    year VARCHAR(50),
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    badges TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasknest.tasks (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    creator_id BIGINT REFERENCES tasknest.users(id) ON DELETE SET NULL,
    assignee_id BIGINT REFERENCES tasknest.users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    progress INT NOT NULL DEFAULT 0,
    subject TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submission_github TEXT,
    submission_docs TEXT,
    submission_drive TEXT,
    submission_notes TEXT,
    extension_email_sent BOOLEAN DEFAULT FALSE,
    max_assignees INT DEFAULT 1,
    capacity INT NOT NULL DEFAULT 1,
    priority VARCHAR(20) DEFAULT 'Medium',
    ai_optimized BOOLEAN DEFAULT FALSE,
    ai_milestone_count INT DEFAULT 0,
    issue_type VARCHAR(50) DEFAULT 'Task',
    labels TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tasknest.task_assignees (
    task_id    BIGINT NOT NULL REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES tasknest.users(id) ON DELETE CASCADE,
    status     VARCHAR(50) NOT NULL DEFAULT 'accepted',
    progress   INT NOT NULL DEFAULT 0,
    submission_link TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasknest.task_invitations (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    task_id BIGINT NOT NULL REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, invitee_email)
);

CREATE TABLE IF NOT EXISTS tasknest.activities (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    task_id BIGINT REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES tasknest.users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasknest.task_links (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    source_task_id BIGINT NOT NULL REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    target_task_id BIGINT NOT NULL REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasknest.waitlist (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasknest.workspaces (
    id           BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    name         VARCHAR(255) NOT NULL,
    description  TEXT DEFAULT '',
    type         VARCHAR(20) NOT NULL DEFAULT 'team',
    category     VARCHAR(50) DEFAULT 'team',
    owner_id     BIGINT NOT NULL REFERENCES tasknest.users(id) ON DELETE CASCADE,
    invite_code  VARCHAR(32) UNIQUE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasknest.workspace_members (
    workspace_id BIGINT NOT NULL REFERENCES tasknest.workspaces(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES tasknest.users(id) ON DELETE CASCADE,
    role         VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasknest.workspace_invitations (
    id           BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    workspace_id BIGINT NOT NULL REFERENCES tasknest.workspaces(id) ON DELETE CASCADE,
    inviter_id   BIGINT NOT NULL REFERENCES tasknest.users(id) ON DELETE CASCADE,
    email        VARCHAR(255) NOT NULL,
    role         VARCHAR(20) NOT NULL DEFAULT 'member',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    token        VARCHAR(64) UNIQUE NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS tasknest.workspace_milestones (
    id           BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    workspace_id BIGINT NOT NULL REFERENCES tasknest.workspaces(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT DEFAULT '',
    due_date     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasknest.workspace_tasks (
    id           BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    workspace_id BIGINT NOT NULL REFERENCES tasknest.workspaces(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT DEFAULT '',
    status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority     VARCHAR(20) DEFAULT 'Medium',
    creator_id   BIGINT NOT NULL REFERENCES tasknest.users(id) ON DELETE CASCADE,
    assignee_id  BIGINT REFERENCES tasknest.users(id) ON DELETE SET NULL,
    milestone_id BIGINT REFERENCES tasknest.workspace_milestones(id) ON DELETE SET NULL,
    due_date     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subject TEXT DEFAULT '',
    attachment_url TEXT DEFAULT '',
    issue_type VARCHAR(50) DEFAULT 'Task',
    labels TEXT[] DEFAULT '{}',
    ai_milestone_count INT DEFAULT 0,
    ai_optimized BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tasknest.milestones (
    id BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    task_id BIGINT NOT NULL,
    marketplace_task_id BIGINT REFERENCES tasknest.tasks(id) ON DELETE CASCADE,
    workspace_task_id BIGINT REFERENCES tasknest.workspace_tasks(id) ON DELETE CASCADE,
    CHECK (num_nonnulls(marketplace_task_id, workspace_task_id) = 1),
    CHECK (task_id = COALESCE(marketplace_task_id, workspace_task_id)),
    title TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submission_link TEXT,
    submission_note TEXT,
    assignee_id BIGINT REFERENCES tasknest.users(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasknest.workspace_activities (
    id           BIGINT PRIMARY KEY DEFAULT nextval('tasknest.entity_id_seq'),
    workspace_id BIGINT NOT NULL REFERENCES tasknest.workspaces(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES tasknest.users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,
    details      TEXT DEFAULT '',
    entity_type  VARCHAR(50) DEFAULT '',
    entity_id    BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Milestones support two task types while retaining proper PostgreSQL foreign keys.
CREATE OR REPLACE FUNCTION tasknest.resolve_milestone_task() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, tasknest AS $$
BEGIN
    NEW.marketplace_task_id := NULL;
    NEW.workspace_task_id := NULL;
    SELECT id INTO NEW.marketplace_task_id FROM tasknest.tasks WHERE id = NEW.task_id;
    IF NEW.marketplace_task_id IS NULL THEN
        SELECT id INTO NEW.workspace_task_id FROM tasknest.workspace_tasks WHERE id = NEW.task_id;
    END IF;
    IF NEW.marketplace_task_id IS NULL AND NEW.workspace_task_id IS NULL THEN
        RAISE EXCEPTION 'Milestone task does not exist' USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER resolve_milestone_task BEFORE INSERT OR UPDATE OF task_id, marketplace_task_id, workspace_task_id
ON tasknest.milestones FOR EACH ROW EXECUTE FUNCTION tasknest.resolve_milestone_task();

CREATE INDEX IF NOT EXISTS tasks_creator_idx ON tasknest.tasks (creator_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasknest.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS milestones_task_idx ON tasknest.milestones (task_id, position);
CREATE INDEX IF NOT EXISTS task_invitations_email_idx ON tasknest.task_invitations (invitee_email);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON tasknest.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS workspace_tasks_workspace_idx ON tasknest.workspace_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_activities_workspace_idx ON tasknest.workspace_activities (workspace_id, created_at);

