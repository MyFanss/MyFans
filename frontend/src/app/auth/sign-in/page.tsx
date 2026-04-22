import { Metadata } from "next";
import AuthSignInClient from "./AuthSignInClient";

export const metadata: Metadata = {
  title: "Sign in | MyFans",
  description: "Sign in with your wallet to access protected MyFans pages.",
};

export default function AuthSignInPage() {
  return <AuthSignInClient />;
}
