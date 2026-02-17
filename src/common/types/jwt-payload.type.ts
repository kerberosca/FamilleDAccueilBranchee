import { Role, UserStatus } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  role: Role;
  status: UserStatus;
  email: string;
};
