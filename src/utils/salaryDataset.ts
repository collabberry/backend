import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

// Define the structure of a salary data entry
export interface SalaryEntry {
  Age: string;
  Gender: string;
  "Education Level": string;
  "Job Title": string;
  "Years of Experience": string;
  Salary: string;
  [key: string]: string; // Index signature for any other fields
}

// Define filter operations for string fields
export type StringFilter = {
  type:
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "includes"
    | "excludes";
  value: string;
};

// Define filter operations for numeric fields
export type NumericFilter = {
  type: "equals" | "lessThan" | "greaterThan" | "between";
  value: number;
  maxValue?: number; // For 'between' operations
};

// Define the filter structure
export type Filter = {
  [field: string]: StringFilter | NumericFilter;
};

/**
 * Parse CSV file and return all entries
 * @param filePath Path to the CSV file
 */
export async function parseCSV(filePath: string): Promise<SalaryEntry[]> {
  return new Promise((resolve, reject) => {
    const results: SalaryEntry[] = [];

    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
        }),
      )
      .on("data", (data: SalaryEntry) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

/**
 * Apply filters to salary data
 * @param data Array of salary entries
 * @param filters Object containing filters to apply
 */
export function applyFilters(
  data: SalaryEntry[],
  filters: Filter,
): SalaryEntry[] {
  return data.filter((entry) => {
    // Check each filter against the entry
    for (const [field, filter] of Object.entries(filters)) {
      if (!entry[field]) continue; // Skip if field doesn't exist

      if ("value" in filter && typeof filter.value === "string") {
        // String filter
        const stringFilter = filter as StringFilter;
        const entryValue = String(entry[field]).toLowerCase();
        const filterValue = stringFilter.value.toLowerCase();

        switch (stringFilter.type) {
          case "contains":
            if (!entryValue.includes(filterValue)) return false;
            break;
          case "equals":
            if (entryValue !== filterValue) return false;
            break;
          case "startsWith":
            if (!entryValue.startsWith(filterValue)) return false;
            break;
          case "endsWith":
            if (!entryValue.endsWith(filterValue)) return false;
            break;
          case "includes":
            if (!entryValue.includes(filterValue)) return false;
            break;
          case "excludes":
            if (entryValue.includes(filterValue)) return false;
            break;
        }
      } else {
        // Numeric filter
        const numericFilter = filter as NumericFilter;
        const entryValue = parseFloat(entry[field]);

        if (isNaN(entryValue)) continue; // Skip if not a number

        switch (numericFilter.type) {
          case "equals":
            if (entryValue !== numericFilter.value) return false;
            break;
          case "lessThan":
            if (entryValue >= numericFilter.value) return false;
            break;
          case "greaterThan":
            if (entryValue <= numericFilter.value) return false;
            break;
          case "between":
            if (
              numericFilter.maxValue === undefined ||
              entryValue < numericFilter.value ||
              entryValue > numericFilter.maxValue
            ) {
              return false;
            }
            break;
        }
      }
    }
    return true;
  });
}

/**
 * Get salary data with applied filters
 * @param filePath Path to the CSV file
 * @param filters Object containing filters to apply
 * @param limit Maximum number of results to return (optional)
 */
export async function getSalaryData(
  filePath: string,
  filters: Filter = {},
  limit?: number,
): Promise<SalaryEntry[]> {
  try {
    const data = await parseCSV(filePath);

    // First filter out any incomplete entries (missing required fields)
    const validEntries = data.filter(
      (entry) =>
        entry["Job Title"] &&
        entry["Job Title"].trim() !== "" &&
        entry["Years of Experience"] &&
        entry["Years of Experience"].trim() !== "" &&
        entry["Salary"] &&
        entry["Salary"].trim() !== "" &&
        !isNaN(parseFloat(entry["Salary"])) &&
        !isNaN(parseFloat(entry["Years of Experience"])),
    );

    // Then apply the user-specified filters
    const filteredData =
      Object.keys(filters).length > 0
        ? applyFilters(validEntries, filters)
        : validEntries;

    console.log("[Filters]", filters);

    // Apply limit if specified
    return limit ? filteredData.slice(0, limit) : filteredData;
  } catch (error) {
    console.error("Error processing salary data:", error);
    return [];
  }
}

/**
 * Calculate statistics on numeric field
 * @param data Array of salary entries
 * @param field Field to calculate statistics on
 */
export function calculateStats(data: SalaryEntry[], field: string) {
  const numericValues = data
    .map((entry) => parseFloat(entry[field]))
    .filter((value) => !isNaN(value));

  if (numericValues.length === 0) {
    return {
      min: null,
      max: null,
      avg: null,
      median: null,
      count: 0,
    };
  }

  // Sort values for median calculation
  numericValues.sort((a, b) => a - b);

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const sum = numericValues.reduce((acc, val) => acc + val, 0);
  const avg = sum / numericValues.length;

  // Calculate median
  const mid = Math.floor(numericValues.length / 2);
  const median =
    numericValues.length % 2 === 0
      ? (numericValues[mid - 1] + numericValues[mid]) / 2
      : numericValues[mid];

  return {
    min,
    max,
    avg,
    median,
    count: numericValues.length,
  };
}

/**
 * Get a sample of filtered data for OpenAI prompt
 * @param filePath Path to the CSV file
 * @param filters Filters to apply
 * @param sampleSize Number of entries to include in the sample
 */
export async function getSalaryDataForPrompt(
  filePath: string,
  filters: Filter = {},
  sampleSize = 50,
): Promise<string> {
  try {
    const data = await getSalaryData(filePath, filters);
    console.log("[DATAAAAAA]", data);

    // Get a representative sample
    const sample =
      data.length <= sampleSize
        ? data
        : data
            .sort(() => 0.5 - Math.random()) // Simple shuffle
            .slice(0, sampleSize);

    // Format for OpenAI prompt
    const header = Object.keys(sample[0] || {}).join(", ");
    const rows = sample.map((entry) => Object.values(entry).join(", "));

    return [header, ...rows].join("\n");
  } catch (error) {
    console.error("Error getting salary data for prompt:", error);
    return "";
  }
}

// Example usage:
//
// // Get data with experience > 5 years and job title containing "Manager"
// const filters = {
//   'Years of Experience': { type: 'greaterThan', value: 5 },
//   'Job Title': { type: 'contains', value: 'Manager' }
// };
//
// getSalaryData('./attached_assets/Salary_Data_US.csv', filters, 20)
//   .then(results => console.log(results));
//
// // Calculate stats on salary
// getSalaryData('./attached_assets/Salary_Data_US.csv')
//   .then(data => {
//     const stats = calculateStats(data, 'Salary');
//     console.log('Salary Statistics:', stats);
//   });

/**
 * Process a getSalaryRecommendation tool call and return filtered salary data
 *
 * This function:
 * 1. Creates precise filters based on job title and experience years
 * 2. Gets relevant filtered salary data from CSV files
 * 3. Formats data for both job-specific and general statistics
 * 4. Applies adjustments based on location and experience level
 * 5. Returns a structured result for the second OpenAI call
 */
export const getTemplatePromptContext = async (args: any) => {
  try {
    // Extract parameters - if string input, parse it
    let parsedArgs = args;
    if (typeof args === "string") {
      parsedArgs = JSON.parse(args);
    }

    const {
      jobTitle,
      yearsOfExperience,
      location: { countryName, area },
    } = parsedArgs;
    console.log(
      `[TEMPLATE] Processing salary recommendation for ${jobTitle} with ${yearsOfExperience} years in ${countryName}/${area}`,
    );

    // Create filters for the CSV data
    const filters: Filter = {};
    if (jobTitle) {
      // Check if job title contains multiple words (e.g., "Product Manager")
      if (jobTitle.includes(" ")) {
        const parts = jobTitle.split(" ");
        const roleModifier = parts[0];
        const roleTitle = parts.length > 1 ? parts[1] : "";

        console.log(
          `[ANALYZE] Detected complex job title: modifier="${roleModifier}", title="${roleTitle}"`,
        );

        // First try exact pattern match
        filters["Job Title"] = {
          type: "contains",
          value: jobTitle,
        };
        console.log(
          `[ANALYZE] Added primary Job Title filter: contains exact pattern "${jobTitle}"`,
        );

        // We'll do post-filtering below for multi-part titles
      } else {
        // Simple title, use as-is
        filters["Job Title"] = { type: "contains", value: jobTitle };
        console.log(`[ANALYZE] Added Job Title filter: contains "${jobTitle}"`);
      }
    }

    // We'll handle the experience filter differently - apply it in a progressive manner
    // First try +-1 years, and if no results, gradually expand
    if (yearsOfExperience !== undefined) {
      // Convert to number and create appropriate filter
      const expYears = Number(yearsOfExperience);
      if (!isNaN(expYears)) {
        // We'll store the target years for later use in the progressive search
        // but we won't add the filter yet - we'll do it after querying the data
        console.log(
          `[ANALYZE] Will apply progressive experience filter starting with ±1 year from ${expYears}`,
        );
      } else {
        console.log(
          `[ANALYZE] Couldn't convert years of experience to number: ${yearsOfExperience}`,
        );
      }
    }

    // Log the complete filter object
    console.log(
      "[ANALYZE] Complete filter object:",
      JSON.stringify(filters, null, 2),
    );

    // Get filtered salary data
    console.log(
      `[ANALYZE] Fetching filtered salary data with ${Object.keys(filters).length} filters`,
    );
    const usSalaryPath = path.join(
      process.cwd(),
      "attached_assets",
      "Salary_Data_US.csv",
    );

    // Progressive experience range search
    let salaryData: SalaryEntry[] = [];
    const allData = await parseCSV(usSalaryPath);

    // Apply basic filters first (excluding experience)
    const baseFilters = { ...filters };
    delete baseFilters["Years of Experience"];
    let initialFiltered = applyFilters(allData, baseFilters);
    let secondaryFiltered: any[] = [];
    let tertiaryFiltered: any[] = [];

    if (initialFiltered.length === 0) {
      // If no results with basic filters, try filtering only by the job title modifier
      console.log(
        `[ANALYZE] No results with basic filters, trying filtering by modifier only`,
      );
      // Apply modifier filter
      if (jobTitle && jobTitle.includes(" ")) {
        const parts = jobTitle.split(" ");
        const roleModifier = parts[0].toLowerCase();
        const modifierFilter: Filter = {
          "Job Title": {
            type: "contains",
            value: roleModifier,
          },
        };
        secondaryFiltered = applyFilters(allData, modifierFilter);
        console.log(
          `[ANALYZE] Found ${secondaryFiltered.length} matches with modifier filter`,
        );
      }
    } else {
      secondaryFiltered = [];
    }

    if (initialFiltered.length === 0 && secondaryFiltered.length === 0) {
      console.log(
        `[ANALYZE] No matches with basic filters or modifier, trying filtering by role`,
      );
      // Apply role filter
      const roleFilter: Filter = {
        "Job Title": {
          type: "contains",
          value: jobTitle.split(" ")[1] || jobTitle, // Use second word if exists, else use full title
        },
      };
      tertiaryFiltered = applyFilters(allData, roleFilter);
      console.log(
        `[ANALYZE] Found ${tertiaryFiltered.length} matches with role (tertiary) filter`,
      );
    } else {
      tertiaryFiltered = [];
    }

    // Now progressively apply experience filter with expanding ranges
    if (yearsOfExperience !== undefined) {
      const expYears = Number(yearsOfExperience);
      if (!isNaN(expYears)) {
        // First try exact year match
        console.log(
          `[ANALYZE] Trying exact experience match: ${expYears} years`,
        );
        let experienceFilter: Filter = {
          "Years of Experience": {
            type: "equals",
            value: expYears,
          },
        };

        let filtered;
        if (tertiaryFiltered.length > 0) {
          filtered = applyFilters(tertiaryFiltered, experienceFilter);
        } else if (secondaryFiltered.length > 0) {
          filtered = applyFilters(secondaryFiltered, experienceFilter);
        } else {
          filtered = applyFilters(initialFiltered, experienceFilter);
        }
        // If exact match found results, use them
        if (filtered.length > 0) {
          salaryData = filtered;
          console.log(
            `[ANALYZE] Found ${filtered.length} matching entries with exact ${expYears} years experience`,
          );
        } else {
          // Otherwise, progressively expand the range up to ±10 years
          console.log(`[ANALYZE] No exact matches, trying progressive ranges`);
          let rangeExpansion = 1;
          const maxRangeExpansion = 10;

          while (rangeExpansion <= maxRangeExpansion) {
            const minExp = Math.max(0, expYears - rangeExpansion);
            const maxExp = expYears + rangeExpansion;

            console.log(
              `[ANALYZE] Trying experience range: ${minExp}-${maxExp} years (±${rangeExpansion})`,
            );

            // Filter with expanded range
            experienceFilter = {
              "Years of Experience": {
                type: "between",
                value: minExp,
                maxValue: maxExp,
              },
            };

            filtered = applyFilters(initialFiltered, experienceFilter);

            // If we found entries or reached our max range, use these results
            if (filtered.length > 0 || rangeExpansion === maxRangeExpansion) {
              salaryData = filtered;
              console.log(
                `[ANALYZE] Found ${filtered.length} matching entries with experience range ±${rangeExpansion} years`,
              );
              break;
            }

            // Otherwise, expand the range and try again
            rangeExpansion++;
          }
        }
      } else {
        // If experience is not a number, just use the base filters
        salaryData = initialFiltered;
      }
    } else {
      // If no experience specified, just use the base filters
      salaryData = initialFiltered;
    }

    console.log(
      `[ANALYZE] Found ${salaryData.length} matching entries with progressive filtering`,
    );

    // Apply post-processing for multi-word job titles
    if (jobTitle && jobTitle.includes(" ") && salaryData.length > 0) {
      // For multi-word titles like "Product Manager", if we didn't match exactly,
      // we want to do a more sophisticated search
      const parts = jobTitle.split(" ");
      const roleModifier = parts[0].toLowerCase();

      // If we're using a generic title filter rather than exact match,
      // apply secondary filtering for the modifier term
      if (filters["Job Title"] && filters["Job Title"].value !== jobTitle) {
        console.log(
          `[ANALYZE] Applying secondary filter for modifier: "${roleModifier}"`,
        );

        // Further filter to find entries with both terms (modifier and title)
        const filteredByModifier = salaryData.filter((entry) =>
          entry["Job Title"].toLowerCase().includes(roleModifier),
        );

        if (filteredByModifier.length > 0) {
          console.log(
            `[ANALYZE] Secondary filter found ${filteredByModifier.length} entries with "${roleModifier}" in the title`,
          );
          salaryData = filteredByModifier;
        } else {
          console.log(
            `[ANALYZE] Secondary filter found no matches, keeping original results`,
          );
        }
      }
    }

    console.log(
      `[ANALYZE] Final dataset has ${salaryData.length} matching salary entries`,
    );

    // Display all matching entries
    console.log("[ANALYZE] Complete list of matching salary entries:");
    if (salaryData.length > 0) {
      salaryData.forEach((entry, index) => {
        // At this point, all entries should have required fields since we filter in getSalaryData
        // Check that we have complete data before logging
        const experience = entry["Years of Experience"]
          ? `${entry["Years of Experience"]} years`
          : "Unknown";
        const gender = entry["Gender"] || "Unknown";
        const education = entry["Education Level"] || "Unknown";
        const salary = entry["Salary"] ? `$${entry["Salary"]}` : "Unknown";

        console.log(
          `[ANALYZE] Entry ${index + 1}: ${entry["Job Title"]} (${experience}, ${gender}, ${education}): ${salary}/year`,
        );
      });

      // Calculate statistics for matching entries
      const stats = calculateStats(salaryData, "Salary");
      console.log("[ANALYZE] Salary statistics for matched entries:");
      console.log(
        `[ANALYZE] - Average: $${Math.round(stats.avg || 0).toLocaleString()}/year ($${Math.round((stats.avg || 0) / 12).toLocaleString()}/month)`,
      );
      console.log(
        `[ANALYZE] - Median: $${Math.round(stats.median || 0).toLocaleString()}/year ($${Math.round((stats.median || 0) / 12).toLocaleString()}/month)`,
      );
      console.log(
        `[ANALYZE] - Min: $${Math.round(stats.min || 0).toLocaleString()}/year ($${Math.round((stats.min || 0) / 12).toLocaleString()}/month)`,
      );
      console.log(
        `[ANALYZE] - Max: $${Math.round(stats.max || 0).toLocaleString()}/year ($${Math.round((stats.max || 0) / 12).toLocaleString()}/month)`,
      );

      // Calculate monthly values
      console.log("[ANALYZE] Monthly salary conversion examples:");
      [
        { title: "Entry level", salary: stats.min || 0 },
        { title: "Average", salary: stats.avg || 0 },
        { title: "Experienced", salary: stats.max || 0 },
      ].forEach((example) => {
        const monthlySalary = example.salary / 12;
        const roundedMonthlySalary = Math.round(monthlySalary / 250) * 250; // Round to nearest $250
        console.log(
          `[ANALYZE] - ${example.title}: $${example.salary.toLocaleString()}/year ÷ 12 = $${monthlySalary.toLocaleString()}/month → rounded to $${roundedMonthlySalary.toLocaleString()}/month`,
        );
      });

      const entryLevelInfo = () => {
        const monthlySalary = (stats.min || 0) / 12;
        const roundedMonthlySalary = Math.round(monthlySalary / 250) * 250;
        return `Min: $${monthlySalary}/year ÷ 12 = $${roundedMonthlySalary}/month → rounded to $${roundedMonthlySalary}/month`;
      };

      const averageInfo = () => {
        const monthlySalary = (stats.avg || 0) / 12;
        const roundedMonthlySalary = Math.round(monthlySalary / 250) * 250;
        return `Average: $${monthlySalary}/year ÷ 12 = $${roundedMonthlySalary}/month → rounded to $${roundedMonthlySalary}/month`;
      };

      const experiencedInfo = () => {
        const monthlySalary = (stats.max || 0) / 12;
        const roundedMonthlySalary = Math.round(monthlySalary / 250) * 250;
        return `Max: $${monthlySalary}/year ÷ 12 = $${roundedMonthlySalary}/month → rounded to $${roundedMonthlySalary}/month`;
      };

      // Get more general data for broader comparison
      console.log("[TEMPLATE] Getting broader data for comparison");
      const generalFilters: Filter = {};
      if (jobTitle) {
        // For multi-word titles, use first word only
        const primaryKeyword = jobTitle.split(" ")[0];
        generalFilters["Job Title"] = {
          type: "contains",
          value: primaryKeyword,
        };
      }

      const generalData = await getSalaryData(usSalaryPath, generalFilters, 20);
      console.log(`[TEMPLATE] Found ${generalData.length} general matches`);

      // Calculate statistics for the broader dataset
      const generalStats = calculateStats(generalData, "Salary");

      // Get country multipliers for location adjustment
      let countryMultiplier = 1.0; // Default multiplier for US

      try {
        // Parse the country multipliers CSV
        const countryMultipliersPath = path.join(
          process.cwd(),
          "attached_assets",
          "Salary_Multiplier_By_Country.csv",
        );
        const multipliers = await parseCSV(countryMultipliersPath);
        const countryColumn = "Country/Area";

        // Find the multiplier for the specified location
        // const multiplierEntry = multipliers.find(
        //   (entry) =>
        //     entry[countryColumn] &&
        //     location &&
        //     entry[countryColumn].toLowerCase().includes(location.toLowerCase()),
        // );
        const multiplierEntry = multipliers.find((entry) => {
          const entryCountry = entry[countryColumn]?.toLowerCase();
          const isEqualByCountry =
            entry[countryColumn].toLowerCase() === countryName?.toLowerCase();
          const isEqualByArea =
            entry[countryColumn].toLowerCase() === area?.toLowerCase();

          return isEqualByCountry || isEqualByArea;
        });

        if (multiplierEntry && multiplierEntry.Multiplier) {
          countryMultiplier = parseFloat(multiplierEntry.Multiplier);
          console.log(
            `[TEMPLATE] Found multiplier ${countryMultiplier} for ${countryName}/${area}`,
          );
        } else {
          console.log(
            `[TEMPLATE] No specific multiplier found for ${countryName}/${area}, using default 1.0`,
          );
        }
      } catch (error) {
        console.error("[TEMPLATE] Error loading country multipliers:", error);
      }

      // No experience-based adjustment needed as we're already filtering by experience
      const experienceMultiplier = 1.0;

      // Format the results
      const roleSpecificData = salaryData.slice(0, 5).map((d) => ({
        jobTitle: d["Job Title"],
        experience: parseFloat(d["Years of Experience"]),
        salary: parseFloat(d["Salary"]),
        education: d["Education Level"],
        gender: d["Gender"],
      }));

      // Format all data for general analysis
      const allRelevantData = generalData.slice(0, 10).map((d) => ({
        jobTitle: d["Job Title"],
        experience: parseFloat(d["Years of Experience"]),
        salary: parseFloat(d["Salary"]),
        education: d["Education Level"],
      }));

      // Calculate suggested monthly rate (annual ÷ 12)
      // Apply the country multiplier
      const monthlyMedianSalary =
        ((stats.median || 0) / 12) * countryMultiplier;

      // Round to nearest $250
      const roundedMonthlySalary = Math.round(monthlyMedianSalary / 250) * 250;

      return {
        jobTitle,
        yearsOfExperience,
        location: { countryName, area },
        countryMultiplier,
        specificMatches: {
          count: salaryData.length,
          medianSalary: stats.median,
          avgSalary: stats.avg,
          minSalary: stats.min,
          maxSalary: stats.max,
          // samples: roleSpecificData
        },
        // generalMatches: {
        //   count: generalData.length,
        //   medianSalary: generalStats.median,
        //   avgSalary: generalStats.avg,
        //   minSalary: generalStats.min,
        //   maxSalary: generalStats.max,
        //   samples: allRelevantData
        // },
        suggestedMonthlyRate: {
          exact: monthlyMedianSalary,
          rounded: roundedMonthlySalary,
          calculation: `${stats.median} (annual median) / 12 * ${countryMultiplier} (location) = $${roundedMonthlySalary}/month`,
        },
      };
    } else {
      console.log(
        "[TEMPLATE] No matching salary entries found with current filters",
      );
      console.log("[TEMPLATE] Using general data as fallback");

      // Get general salary data as fallback
      const generalFilters: Filter = {};
      const usSalaryPath = path.join(
        process.cwd(),
        "attached_assets",
        "Salary_Data_US.csv",
      );
      const generalData = await getSalaryData(usSalaryPath, generalFilters, 20);
      const generalStats = calculateStats(generalData, "Salary");

      return {
        jobTitle,
        yearsOfExperience,
        location: { countryName, area },
        error:
          "No specific matches found for the requested role and experience",
        generalMatches: {
          count: generalData.length,
          medianSalary: generalStats.median,
          avgSalary: generalStats.avg,
          minSalary: generalStats.min,
          maxSalary: generalStats.max,
        },
        suggestedMonthlyRate: {
          exact: (generalStats.median || 0) / 12,
          rounded: Math.round((generalStats.median || 0) / 12 / 250) * 250,
          calculation:
            "Using general salary data as fallback due to no specific matches",
        },
      };
    }
  } catch (error) {
    console.error("[TEMPLATE] Error processing salary recommendation:", error);
    return {
      error: `Failed to process salary data: ${error}`,
      jobTitle: args.jobTitle || "Unknown",
      yearsOfExperience: args.yearsOfExperience || 0,
      location: { countryName, area },
      suggestedMonthlyRate: {
        rounded: 0,
        calculation: "Error processing data",
      },
    };
  }
};
