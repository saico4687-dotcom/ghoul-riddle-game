insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'abdallahaniss369@gmail.com'
on conflict do nothing;

select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id;
