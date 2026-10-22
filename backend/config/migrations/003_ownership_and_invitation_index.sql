-- Do not silently cascade account deletion through shared workspaces.
ALTER TABLE tasknest.workspaces DROP CONSTRAINT workspaces_owner_id_fkey;
ALTER TABLE tasknest.workspaces ADD CONSTRAINT workspaces_owner_id_fkey
 FOREIGN KEY (owner_id) REFERENCES tasknest.users(id) ON DELETE RESTRICT;

CREATE INDEX task_invitations_email_canonical_idx
 ON tasknest.task_invitations (lower(trim(invitee_email)));
