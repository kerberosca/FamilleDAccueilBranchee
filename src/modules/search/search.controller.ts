import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { SearchResourcesDto } from "./dto/search-resources.dto";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller({ path: "search", version: "1" })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get("resources")
  async searchResources(@Query() query: SearchResourcesDto, @CurrentUser() user?: JwtPayload) {
    return this.searchService.searchResources(query, user);
  }
}
