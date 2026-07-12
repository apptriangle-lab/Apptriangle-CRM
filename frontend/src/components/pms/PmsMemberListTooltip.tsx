import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";

export type PmsMemberListPerson = {
  userId: string;
  name: string;
  email?: string | null;
  badge?: string | null;
};

export function PmsMemberListTooltipContent({
  title,
  countLabel,
  members,
}: {
  title: string;
  countLabel: string;
  members: PmsMemberListPerson[];
}) {
  return (
    <div className="w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-xs text-slate-600">{countLabel}</p>
      </div>
      <ul className="max-h-56 overflow-y-auto p-1.5 scrollbar-thinner">
        {members.map((member) => {
          const email = member.email?.trim();

          return (
            <li
              key={member.userId}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left"
            >
              <PmsMemberAvatar name={member.name} userId={member.userId} size="sm" hideTitle />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{member.name}</p>
                  {member.badge ? (
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {member.badge}
                    </span>
                  ) : null}
                </div>
                {email ? <p className="truncate text-[11px] text-slate-500">{email}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
