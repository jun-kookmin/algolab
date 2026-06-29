import React from "react";

import { formatDisplayName, formatNameFromParts } from "@/utils/name";
import MySubmissionDetailContent from "@/app/submission/[userid]/MySubmissionDetailContent";
import { getServerMe, getServerUnifiedUserSubmissions } from "../../lib/serverApi";

export const dynamic = "force-dynamic";

const MySubmission = async () => {
  let uid = 0;
  let userName = "";
  let initialData = undefined;

  try {
    const me = await getServerMe();
    uid = me?.pk ? Number(me.pk) : 0;
    userName =
      formatNameFromParts(me?.first_name, me?.last_name) ||
      formatDisplayName(me?.username);
  } catch {
    uid = 0;
    userName = "";
  }

  if (uid) {
    try {
      initialData = await getServerUnifiedUserSubmissions(uid, false);
    } catch {
      initialData = undefined;
    }
  }

  return (
    <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
      <div className="fluid-container pb-20 pt-3">
        <MySubmissionDetailContent
          userId={uid}
          userName={userName}
          initialData={initialData}
        />
      </div>
    </section>
  );
};

export default MySubmission;
