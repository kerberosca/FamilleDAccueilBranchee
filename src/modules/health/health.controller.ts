import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
