-- Run against an initialized TaskNest PostgreSQL database. All test rows roll back.
BEGIN;
SET LOCAL search_path = tasknest;
DO $$
DECLARE
 u BIGINT; task BIGINT; workspace BIGINT; workspace_task BIGINT;
 market_milestone BIGINT; team_milestone BIGINT; n BIGINT; rejected BOOLEAN := FALSE;
BEGIN
 INSERT INTO users (name,email,password) VALUES ('Migration smoke test','migration-smoke@example.invalid','not-a-real-login') RETURNING id INTO u;
 INSERT INTO tasks (title,creator_id,labels) VALUES ('Marketplace smoke test',u,ARRAY['test']) RETURNING id INTO task;
 INSERT INTO workspaces (name,owner_id,invite_code) VALUES ('Workspace smoke test',u,'smoke-'||u) RETURNING id INTO workspace;
 INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (workspace,u,'owner');
 INSERT INTO workspace_tasks (workspace_id,title,creator_id,subject,attachment_url,issue_type,labels)
 VALUES (workspace,'Workspace task smoke test',u,'SQL','','Task',ARRAY['test']) RETURNING id INTO workspace_task;
 IF task=workspace_task THEN RAISE EXCEPTION 'Task IDs collide across task types'; END IF;
 INSERT INTO milestones (task_id,title) VALUES (task,'Marketplace milestone') RETURNING id INTO market_milestone;
 INSERT INTO milestones (task_id,title) VALUES (workspace_task,'Workspace milestone') RETURNING id INTO team_milestone;
 IF NOT EXISTS (SELECT 1 FROM milestones WHERE id=market_milestone AND marketplace_task_id=task AND workspace_task_id IS NULL) THEN
  RAISE EXCEPTION 'Marketplace milestone did not retain a foreign key';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM milestones WHERE id=team_milestone AND workspace_task_id=workspace_task AND marketplace_task_id IS NULL) THEN
  RAISE EXCEPTION 'Workspace milestone did not retain a foreign key';
 END IF;
 BEGIN
  INSERT INTO milestones (task_id,title) VALUES (-1,'Invalid parent');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=TRUE;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Orphan milestone was accepted'; END IF;
 INSERT INTO task_assignees (task_id,user_id) VALUES (task,u);
 INSERT INTO task_invitations (task_id,invitee_email) VALUES (task,'invite@example.invalid');
 INSERT INTO activities (task_id,user_id,action,details) VALUES (task,u,'comment','Smoke test');
 INSERT INTO workspace_activities (workspace_id,user_id,action,entity_type,entity_id) VALUES (workspace,u,'created','task',workspace_task);
 UPDATE workspace_tasks SET ai_milestone_count=1,ai_optimized=TRUE WHERE id=workspace_task;
 UPDATE milestones SET position=1,assignee_id=u,submission_link='https://example.invalid' WHERE id=team_milestone;
 DELETE FROM tasks WHERE id=task;
 IF EXISTS (SELECT 1 FROM milestones WHERE id=market_milestone) THEN RAISE EXCEPTION 'Marketplace milestone did not cascade'; END IF;
 DELETE FROM workspaces WHERE id=workspace;
 IF EXISTS (SELECT 1 FROM milestones WHERE id=team_milestone) THEN RAISE EXCEPTION 'Workspace milestone did not cascade'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AND has_schema_privilege('anon','tasknest','USAGE') THEN
  RAISE EXCEPTION 'TaskNest schema is exposed to anonymous API access';
 END IF;
 SELECT COUNT(*) INTO n FROM tasknest.schema_migrations;
 IF n<1 THEN RAISE EXCEPTION 'Migration tracking is missing'; END IF;
END;
$$;
ROLLBACK;
SELECT 'passed: both task types, globally unique IDs, milestones, foreign keys, cascades, private schema, and rollback' AS smoke_test;
