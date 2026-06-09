import * as React from "react";
import { EmailLayout } from "./_layout";

export default function Recovery() {
  return (
    <EmailLayout
      preview="Reset your vids.tube password"
      heading="Reset your password"
      intro="We received a request to reset the password for your vids.tube account. Click the button below to choose a new password."
      buttonLabel="Reset password"
      buttonUrl="{{ .ConfirmationURL }}"
      footnote="If you didn't request a password reset, you can safely ignore this email — your password won't change."
    />
  );
}
