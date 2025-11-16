import VerifyEmailClient from "./VerifyEmailClient";

type PageProps = {
  searchParams: {
    email?: string;
  };
};

export default function Page({ searchParams }: PageProps) {
  const emailParam = Array.isArray(searchParams.email)
    ? searchParams.email[0]
    : searchParams.email || "";

  return <VerifyEmailClient email={emailParam} />;
}
