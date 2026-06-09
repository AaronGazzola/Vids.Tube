import * as React from "react";
import { EmailLayout } from "./_layout";

export default function EmailChange() {
  return (
    <EmailLayout
      preview="Confirm your new email address for vids.tube"
      heading="Confirm your email change"
      intro="We received a request to change the email address on your vids.tube account from {{ .Email }} to {{ .NewEmail }}. Click the button below to confirm this change."
      buttonLabel="Confirm email change"
      buttonUrl="{{ .ConfirmationURL }}"
      footnote="If you didn't request this change, please secure your account — do not click the button above."
    />
  );
}
