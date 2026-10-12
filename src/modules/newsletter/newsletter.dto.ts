import { Transform } from "class-transformer";
import { Equals, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class NewsletterSourceDto {
  @IsIn(["site", "congres"])
  source!: "site" | "congres";
}

export class SubscribeNewsletterDto extends NewsletterSourceDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Equals(true)
  consent!: true;

  @IsString()
  @Length(1, 1500)
  formToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}
