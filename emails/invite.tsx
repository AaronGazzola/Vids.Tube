import * as React from "react";
import { EmailLayout } from "./_layout";

export default function Invite() {
  return (
    <EmailLayout
      preview="You've been invited to vids.tube"
      heading="You've been invited"
      intro="You've been invited to join vids.tube. Click the button below to accept the invitation and set up your account."
      buttonLabel="Accept invitation"
      buttonUrl="{{ .ConfirmationURL }}"
      footnote="If you weren't expecting this invitation, you can safely ignore this email."
    />
  );
}
