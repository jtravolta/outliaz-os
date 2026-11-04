"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ProspectOption = {
  id: string;
  businessName: string;
  email: string | null;
};

export function OutreachDraftEditor({
  prospects,
}: {
  prospects: ProspectOption[];
}) {
  const [id, setId] = useState(prospects[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Draft · not sent");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setStatus("Draft · not sent");
    fetch(`/api/prospects/${id}/draft`)
      .then((response) => response.json())
      .then((data) => {
        setSubject(data.draft?.subject ?? "");
        setBody(data.draft?.body ?? "");
      })
      .catch(() => setStatus("Could not load draft"));
  }, [id]);

  async function save() {
    if (!id || !subject.trim() || !body.trim()) {
      setStatus("Add a subject and message before saving");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/prospects/${id}/draft`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    setSaving(false);
    setStatus(response.ok ? "Saved · not sent" : "Draft could not be saved");
  }

  const selected = prospects.find((prospect) => prospect.id === id);
  return (
    <section className="draft-editor" aria-label="First email draft">
      <div className="draft-safety">
        <strong>{status}</strong>
        <span>
          Saving stores this draft only. It will not send or queue email.
        </span>
      </div>
      {prospects.length ? (
        <>
          <label htmlFor="draft-prospect">Prospect</label>
          <select
            id="draft-prospect"
            className="field"
            value={id}
            onChange={(event) => setId(event.target.value)}
          >
            {prospects.map((prospect) => (
              <option key={prospect.id} value={prospect.id}>
                {prospect.businessName}
              </option>
            ))}
          </select>
          <p className="draft-recipient">
            Recipient:{" "}
            {selected?.email ??
              "No email yet — you can still prepare the draft."}
          </p>
          <label htmlFor="draft-subject">Subject</label>
          <input
            id="draft-subject"
            className="field"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label htmlFor="draft-body">Message</label>
          <textarea
            id="draft-body"
            className="field min-h-56"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </>
      ) : (
        <p>
          No prospects are available yet. Import or add one before drafting.
        </p>
      )}
    </section>
  );
}
