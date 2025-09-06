import { Injectable, OnApplicationBootstrap } from "@nestjs/common";

@Injectable()
export class AppService implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    console.log("Started..");
  }
}
