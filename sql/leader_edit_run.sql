-- Lets the leader who created a run edit it from the ✏️ button.
-- Day / date / time are NOT editable here; those still go through
-- leader_change_run_time (the ⏰ button and its 8-hour approval rule).
-- Run once in Supabase → SQL Editor.

create or replace function public.leader_edit_run(
  p_run_id          bigint,
  p_title           text,
  p_notes           text,
  p_background_key  text,
  p_ilvl_required   integer,
  p_exp_required    text,
  p_healer_limit    integer,
  p_dps_limit       integer,
  p_signup_open_at  timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_LEADER';
  end if;

  if not exists (
    select 1 from public.runs
    where id = p_run_id and created_by = auth.uid()
  ) then
    raise exception 'NOT_LEADER';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'The run needs a title.';
  end if;

  update public.runs set
    title          = trim(p_title),
    notes          = p_notes,
    background_key = p_background_key,
    ilvl_required  = p_ilvl_required,
    exp_required   = p_exp_required,
    healer_limit   = greatest(coalesce(p_healer_limit, 3), 0),
    dps_limit      = greatest(coalesce(p_dps_limit, 10), 0),
    signup_open_at = p_signup_open_at
  where id = p_run_id;
end;
$$;

revoke all on function public.leader_edit_run(bigint, text, text, text, integer, text, integer, integer, timestamptz) from public, anon;
grant execute on function public.leader_edit_run(bigint, text, text, text, integer, text, integer, integer, timestamptz) to authenticated;
