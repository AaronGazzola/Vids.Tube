import * as React from "react";
import { EmailLayout } from "./_layout";

export default function MagicLink() {
  return (
    <EmailLayout
      preview="Your vids.tube magic link"
      heading="Log in to vids.tube"
      intro="Click the button below to securely log in to your vids.tube account. This link will expire shortly and can only be used once."
      buttonLabel="Log in"
      buttonUrl="{{ .ConfirmationURL }}"
      footnote="If you didn't try to log in, you can safely ignore this email."
    />
  );
}
