import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

/** Same boundary, same reason as the sign-in page — see the note there. */
export default function SignUpPage() {
  return (
    <div className="flex justify-center py-8">
      <Suspense fallback={<div aria-hidden="true" className="h-96" />}>
        <SignUp />
      </Suspense>
    </div>
  );
}
