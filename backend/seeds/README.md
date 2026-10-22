# Global workspace sample tasks

`global_tasks.sql` adds 60 public sample tasks across 15 subjects. It has already
been applied to the connected TaskNest Supabase database.

Each task includes an objective, scoped requirements, deliverables, completion
criteria, and submission instructions. All start pending with zero progress,
2–4 participant slots, and deadlines 21–45 days after insertion. Tasks are posted
by **TaskNest Samples**, a dedicated `seed` profile with no password, and marked
with `sample` and `global-starter-v1` labels. They are examples, not requests from
real students.

The app's global workspace is backed by `tasknest.tasks`; these are not team
workspace records. Refresh the global Marketplace view to see the tasks.

`global_tasks.json` is the readable catalog corresponding to the SQL seed.
To populate another initialized TaskNest database, run the complete SQL file in
that project's SQL Editor. The seed is transactional and prevents duplicate
inserts on reruns. It preserves existing tasks and does not reset changes made
to previously seeded tasks. It does not run automatically on server startup.
