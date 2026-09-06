import { memoryRepository } from "../../src/server/memory-repository.ts";
import { repositoryContract } from "../repository-contract.ts";

repositoryContract(() => Promise.resolve(memoryRepository()));
