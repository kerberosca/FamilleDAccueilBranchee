import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { DevLoginAsDto } from "./dto/dev-login-as.dto";
import { DevOnlyGuard } from "./guards/dev-only.guard";
import { DevService } from "./dev.service";

@ApiTags("dev")
@Controller({ path: "dev", version: "1" })
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Public()
  @UseGuards(DevOnlyGuard)
  @Post("login-as")
  async loginAs(@Body() body: DevLoginAsDto) {
    return this.devService.loginAs(body.role);
  }
}
