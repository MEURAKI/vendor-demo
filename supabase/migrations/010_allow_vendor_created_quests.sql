-- Allow vendors to create quests by adding 'vendor' to the created_by_role check constraint
alter table quests drop constraint quests_created_by_role_check;
alter table quests add constraint quests_created_by_role_check
  check (created_by_role in ('admin', 'platform', 'vendor'));

-- Allow vendor quest types (assessment, deep_dive, personality, feedback)
alter table quests drop constraint quests_type_check;
alter table quests add constraint quests_type_check
  check (type in ('simple', 'extensive', 'assessment', 'deep_dive', 'personality', 'feedback'));
