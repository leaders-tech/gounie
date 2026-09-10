/*
This file loads shared test setup for frontend unit tests.
Edit this file when all frontend tests need another shared setup step.
Copy the setup style here when you add another global frontend test helper.
*/

import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// findBy* queries wait up to 5 seconds, so debounced searches still pass when the whole suite makes the machine busy.
configure({ asyncUtilTimeout: 5000 });
