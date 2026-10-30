export default interface UserType {
  username: string;
  agent: string;
  privateKey: string;
  codename: string;
  avatar: string | null;
  verificationEntry: {
    exuniteCode: string | null;
    details: string | null;
  } | null;
  vouches: number;
  role: "unverified" | "verified" | "admin";
}
