"use client";

import type { MouseEvent, ReactNode } from "react";

import {
  ConfirmButton,
  Empty,
  ListSection,
  PersonRow,
  SMALL_PRIMARY,
  SMALL_SECONDARY,
  useAction,
} from "@/components/social/parts";
import { Badge } from "@/components/ui/badge";
import { manageGroup, type GroupDetail, type GroupMember } from "@/lib/api/groups";
import { button } from "@/lib/ui";

interface GroupMembersProps {
  group: GroupDetail;
  me: string | null;
  owner: boolean;
  reload: () => void;
  onInvite: (e: MouseEvent<HTMLElement>) => void;
}

/** Who's in, who's invited and, for the owner, who's asking to join. */
export function GroupMembers({ group, me, owner, reload, onInvite }: GroupMembersProps) {
  const change = (sub: string, action: "approve" | "deny" | "remove") => () => manageGroup(group.id, { action, sub }).then(reload);

  return (
    <div className="flex flex-col gap-6 lg:max-w-2xl">
      {owner && group.requests.length > 0 && (
        <ListSection title="Asking to join" count={group.requests.length}>
          {group.requests.map((r) => (
            <li key={r.sub}>
              <Row person={r}>
                {(a) => (
                  <>
                    <button type="button" disabled={a.busy !== null} onClick={() => void a.run("approve", change(r.sub, "approve"))} className={SMALL_PRIMARY}>
                      Let in
                    </button>
                    <button type="button" disabled={a.busy !== null} onClick={() => void a.run("deny", change(r.sub, "deny"))} className={SMALL_SECONDARY}>
                      Deny
                    </button>
                  </>
                )}
              </Row>
            </li>
          ))}
        </ListSection>
      )}

      <ListSection title="Members" count={group.members.length}>
        {group.members.map((m) => (
          <li key={m.sub}>
            <Row
              person={m}
              detail={m.sub === group.owner ? <Badge tone="gold">Owner</Badge> : m.sub === me ? "You" : undefined}
            >
              {(a) =>
                owner && m.sub !== me ? (
                  <ConfirmButton label="Remove" confirm="Remove" busy={a.busy !== null} onConfirm={() => void a.run("remove", change(m.sub, "remove"))} />
                ) : null
              }
            </Row>
          </li>
        ))}
      </ListSection>

      {group.invited.length > 0 && (
        <ListSection title="Invited" count={group.invited.length}>
          {group.invited.map((m) => (
            <li key={m.sub}>
              <PersonRow person={m} detail="Hasn't answered yet" />
            </li>
          ))}
        </ListSection>
      )}

      {group.members.length === 1 && (
        <Empty>
          Just you so far.{" "}
          <button type="button" onClick={onInvite} className={`${button("ghost", "sm")} text-gold-light`}>
            Invite people
          </button>
        </Empty>
      )}
    </div>
  );
}

function Row({
  person,
  detail,
  children,
}: {
  person: GroupMember;
  detail?: ReactNode;
  children: (a: ReturnType<typeof useAction>) => ReactNode;
}) {
  const a = useAction();
  return (
    <PersonRow person={person} detail={detail} error={a.error}>
      {children(a)}
    </PersonRow>
  );
}
