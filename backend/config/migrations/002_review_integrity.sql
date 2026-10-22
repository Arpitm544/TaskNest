-- Fail safely on pre-existing case-colliding accounts; never merge identities.
CREATE UNIQUE INDEX users_email_canonical_idx ON tasknest.users (lower(trim(email)));
UPDATE tasknest.users SET email = lower(trim(email)) WHERE email <> lower(trim(email));
CREATE INDEX IF NOT EXISTS task_assignees_user_idx ON tasknest.task_assignees (user_id);

-- Shared tasks survive deletion of a member who created them.
ALTER TABLE tasknest.workspace_tasks ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE tasknest.workspace_tasks DROP CONSTRAINT workspace_tasks_creator_id_fkey;
ALTER TABLE tasknest.workspace_tasks ADD CONSTRAINT workspace_tasks_creator_id_fkey
 FOREIGN KEY (creator_id) REFERENCES tasknest.users(id) ON DELETE SET NULL;

-- A milestone may only be linked to tasks in its own workspace.
CREATE UNIQUE INDEX workspace_milestones_workspace_id_idx ON tasknest.workspace_milestones (workspace_id, id);
ALTER TABLE tasknest.workspace_tasks DROP CONSTRAINT workspace_tasks_milestone_id_fkey;
ALTER TABLE tasknest.workspace_tasks ADD CONSTRAINT workspace_tasks_milestone_id_fkey
 FOREIGN KEY (workspace_id, milestone_id) REFERENCES tasknest.workspace_milestones(workspace_id, id)
 ON DELETE SET NULL (milestone_id);

-- Internal catalog identity is separate from user-editable labels and titles.
ALTER TABLE tasknest.tasks ADD COLUMN seed_key TEXT UNIQUE;
