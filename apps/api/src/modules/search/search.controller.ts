import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Query deve ter no mínimo 2 caracteres');
    }

    return this.searchService.search(query, user.id, user.role);
  }
}
