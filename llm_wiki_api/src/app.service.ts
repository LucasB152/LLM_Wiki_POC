import { Injectable } from '@nestjs/common';
import { time } from 'console';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
