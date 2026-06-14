import * as React from "react";
import { EmailLayout } from "./_layout";

export default function Confirmation() {
  return (
    <EmailLayout
      preview="Confirm your email to finish setting up your vids.tube account"
      heading="Confirm your email"
      intro="Thanks for signing up. Click the button below to confirm your email address and finish setting up your vids.tube account."
      buttonLabel="Confirm email"
      buttonUrl="{{ .ConfirmationURL }}"
      footnote="If you didn't create a vids.tube account, you can safely ignore this email."
    />
  );
}
