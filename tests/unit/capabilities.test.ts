import { capabilityContract } from "../capability-contract.ts";
import { memoryRepository } from "../../src/server/memory-repository.ts";
capabilityContract(() => Promise.resolve(memoryRepository()));
