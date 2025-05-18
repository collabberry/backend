import OpenAI from "openai";
import {
    getTemplatePromptContext,
} from "./csvParser";
import {
    AgreementSystemPrompt,
    ResponsibilitiesSystemPrompt,
    ResponsibilitiesUserPrompt,
} from "./prompts";

if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const GPT_MODEL = "gpt-4o";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function handleOpenAIRequest<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof Error) {
                lastError = error;
            } else {
                lastError = new Error(String(error));
            }
            console.error(`OpenAI API attempt ${attempt + 1} failed:`, error);

            if (error instanceof Error) {
                if (
                    error.message.includes("429") ||
                    error.message.includes("rate limit")
                ) {
                    console.log(
                        `Rate limit hit, retrying in ${RETRY_DELAY * Math.pow(2, attempt)}ms`,
                    );
                    await delay(RETRY_DELAY * Math.pow(2, attempt));
                    continue;
                }
            }
        }
    }
    console.error("All retry attempts failed. Last error:", lastError);
    throw new Error(
        `OpenAI API Error after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    );
}

export async function testOpenAIConnection(): Promise<boolean> {
    return handleOpenAIRequest(async () => {
        try {
            const response = await openai.chat.completions.create({
                model: GPT_MODEL,
                messages: [
                    {
                        role: "system",
                        content:
                            "You MUST respond with a JSON object. Test the connection with a simple response.",
                    },
                    {
                        role: "user",
                        content: "Test connection, respond with JSON",
                    },
                ],
                response_format: { type: "json_object" },
            });

            // Parse response to ensure it's valid JSON
            const content = response.choices[0].message.content;
            if (!content) {
                return false;
            }

            JSON.parse(content); // This will throw if not valid JSON
            return true;
        } catch (error) {
            console.error("OpenAI connection test failed:", error);
            return false;
        }
    });
}

const messages: any[] = [
    {
        role: "assistant",
        content:
            "Hi! I'd love to understand your interest. Why do you want to join the team?",
    },
];

const responsibilitiesCache: any = {};
let role = "";
let location: any = {};
let yearsOfExperience = 0;
let responsibilities: string[] = [];
let interestInCompany = "";
let jobTitle = "";
let industry = "web3";
let analysis = "";
let marketRate = 0;

export async function analyzeRole(context: string): Promise<{
    analysis: string;
    suggestedRole?: string;
    suggestedExperience?: string;
    suggestedResponsibilities?: string[];
    marketRate?: number;
    suggestedLocation?: string;
}> {
    return handleOpenAIRequest(async () => {
        let parsedContext;
        try {
            parsedContext = JSON.parse(context);
            console.log("[ANALYZE] Parsed context received");
        } catch (e) {
            console.error("[ANALYZE] Failed to parse context:", e);
            console.log("[ANALYZE] Using message as plain text");
            parsedContext = {
                status: "PENDING",
                currentMessage: context,
                conversationHistory: [],
            };
        }

        const { currentMessage, status, conversationHistory } = parsedContext;
        console.log("[STATUS]", status);

        const formatLocation = () => {
            if (location?.countrName && location?.area) {
                return `${location.countrName}, ${location.area}`;
            } else if (location?.countrName) {
                return location.countrName;
            }
            return location?.area;
        };

        const chatHistory = conversationHistory
            .map((message: any) => {
                if (message.type === "user") {
                    return `User: ${message.content}`;
                } else {
                    return `Assistant: ${message.content}`;
                }
            })
            .join("\n");

        if (status === "FINAL") {
            return {
                analysis: "",
                suggestedRole: role || "",
                suggestedExperience: yearsOfExperience
                    ? yearsOfExperience.toString()
                    : "",
                suggestedResponsibilities: responsibilities,
                marketRate: marketRate,
                suggestedLocation: formatLocation(),
            };
        }

        messages.push({
            role: "user",
            content: currentMessage,
        });

        console.log("[ANALYZE] Processing message:", currentMessage);
        console.log(
            `[ANALYZE] Conversation history has ${messages.length} messages`,
        );

        const callLLM = async (history: any[]): Promise<any> => {
            const infoCollectedSoFar = {
                interestInCompany: interestInCompany ?? "NOT_PROVIDED",
                role: role ?? "NOT_PROVIDED",
                responsibilities: responsibilities ?? "NOT_PROVIDED",
                yearsOfExperience: yearsOfExperience ?? "NOT_PROVIDED",
                location: location ?? "NOT_PROVIDED",
            };
            const infoCollectedSoFarStr = JSON.stringify(
                infoCollectedSoFar,
                null,
                2,
            );

            console.log(
                "[ANALYZE] Info collected so far:",
                infoCollectedSoFarStr,
            );
            return await openai.chat.completions.create({
                model: GPT_MODEL,
                messages: [
                    {
                        role: "system",
                        content:
                            AgreementSystemPrompt +
                            "\n\n" +
                            infoCollectedSoFarStr,
                    },
                    ...history,
                ],
                tool_choice: "auto",
                tools: [suggestMarketRateTool],
            });
        };
        const response = await callLLM(messages);
        if (
            response.choices[0].message.tool_calls &&
            response.choices[0].message.tool_calls.length > 0
        ) {
            for (const toolCall of response.choices[0].message.tool_calls) {
                if (toolCall.function.name === "getSalaryRecommendation") {
                    const args: any = JSON.parse(toolCall.function.arguments);
                    console.log("[ANALYZE] Parsed arguments:", args);

                    role = `${args?.role?.modifier} ${args?.role?.title}`;
                    yearsOfExperience = args.yearsOfExperience;
                    location = args.location;
                    jobTitle = args.jobTitle;
                    industry = args.industry || "web3";
                    interestInCompany = args.interestInCompany;
                    responsibilities = args.responsibilities;
                    console.log(
                        "[ANALYZE] Role:",
                        role,
                        "Experience:",
                        yearsOfExperience,
                        "Location:",
                        location,
                        "Job Title:",
                        jobTitle,
                        "Industry:",
                        industry,
                        "Interest in Company:",
                        interestInCompany,
                        "Responsibilities:",
                        responsibilities,
                    );

                    const responsibilitiesArgs: any = {
                        role: role,
                        industry: industry,
                        context: chatHistory,
                    };
                    const { responsibilities: generatedResponsibilities } =
                        await suggestResponsibilities(responsibilitiesArgs);

                    if (generatedResponsibilities?.length) {
                        responsibilities = generatedResponsibilities;
                    }

                    const marketRateTemplateContext =
                        await suggestMarketRate(args);
                    const json_message: any = JSON.parse(
                        marketRateTemplateContext,
                    );

                    marketRate =
                        json_message?.suggestedMonthlyRate?.rounded ?? 0;

                    console.log(
                        "[ANALYZE] Market rate template context:",
                        marketRateTemplateContext,
                    );

                    // make sure all the arguments are passed to the function

                    const updatedData = JSON.stringify({
                        role: role,
                        yearsOfExperience: yearsOfExperience,
                        location: location,
                        jobTitle: jobTitle,
                        industry: industry,
                        interestInCompany: interestInCompany,
                        responsibilities: responsibilities,
                    });
                    const toolCallId = toolCall.id;
                    const toolCalls = {
                        role: "assistant",
                        tool_calls: [
                            {
                                id: toolCallId,
                                type: "function",
                                function: {
                                    name: "getSalaryRecommendation",
                                    arguments: updatedData,
                                },
                            },
                        ],
                    };
                    const toolCallResult = {
                        role: "tool",
                        tool_call_id: toolCallId,
                        content: JSON.stringify(marketRateTemplateContext),
                    };
                    // add to history and call llm again
                    messages.push(toolCalls);
                    messages.push(toolCallResult);
                    messages.push({
                        role: "user",
                        content: `Generate a summary based on market rate and ${updatedData}`,
                    });
                    const newResponse = await callLLM(messages);
                    // add the new response to the conversation history
                    analysis = newResponse.choices[0].message.content || "";
                    messages.push({
                        role: "assistant",
                        content: analysis,
                    });

                    console.log("[ANALYZE] Analysis:", messages);
                }
            }
        } else {
            console.error(
                "[ANALYZE] No tool calls found in response, using fallback data",
            );
            // call llm to collect data
            const response = await callLLM(messages);
            analysis = response.choices[0].message.content || "";
            messages.push({
                role: "assistant",
                content: analysis,
            });
            console.log("[ANALYZE] Analysis:", analysis);
        }

        const final_result = {
            analysis: analysis,
            suggestedRole: role || "",
            suggestedExperience: yearsOfExperience
                ? yearsOfExperience.toString()
                : "",
            suggestedResponsibilities: responsibilities,
            marketRate: marketRate,
            suggestedLocation: formatLocation(),
        };

        console.log("[FINAL RESULT]", final_result);
        return final_result;
    });
}

const roleModifiers = [
    "data",
    "product",
    "marketing",
    "sales",
    "software",
    "web",
    "frontend",
    "backend",
    "full stack",
    "senior",
    "junior",
    "associate",
    "chief",
    "technical",
    "business",
    "finance",
    "hr",
    "content",
    "ux",
    "ui",
    "devops",
    "qa",
    "community",
    "customer",
    "operations",
    "social media",
    "digital",
    "public relations",
];

const roleTitles = [
    "engineer",
    "developer",
    "analyst",
    "manager",
    "designer",
    "director",
    "assistant",
    "consultant",
    "coordinator",
    "specialist",
    "lead",
    "architect",
    "strategist",
    "consultant",
    "representative",
    "administrator",
    "support",
    "advisor",
    "executive",
    "officer",
    "clerk",
    "trainer",
    "scientist",
    "writer",
    "producer",
];

export const suggestMarketRateTool: any = {
    type: "function",
    function: {
        name: "getSalaryRecommendation",
        description:
            "Use these comprehensive salary datasets to recommend data-driven market rates",
        strict: false,
        parameters: {
            type: "object",
            properties: {
                interestInCompany: {
                    type: "string",
                    description:
                        "Question 1: The reason why the user is interesed in joining the team",
                },
                role: {
                    type: "object",
                    description:
                        "Question 2: The role (job title) of the person",
                    properties: {
                        title: {
                            type: "string",
                            description:
                                "The title of the job (e.g. Software Engineer)",
                            enum: roleTitles,
                        },
                        modifier: {
                            type: "string",
                            description:
                                "The modifier of the job (e.g. Senior)",
                            enum: roleModifiers,
                        },
                    },
                    required: ["title", "modifier"],
                },
                responsibilities: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                    description:
                        "Question 3: The key responsibilities of the person.",
                },
                yearsOfExperience: {
                    type: "number",
                    description:
                        "Question 4: The years of experience of the person",
                },
                location: {
                    type: "object",
                    description:
                        "Question 5: The country/area where the person is based.",
                    properties: {
                        countryName: {
                            type: "string",
                        },
                        area: {
                            type: "string",
                            enum: [
                                "Europe",
                                "North America",
                                "South America",
                                "Southeast Asia",
                                "Africa",
                                "Oceania",
                                "East Asia",
                                "South Asia",
                                "Eastern Europe",
                                "Remote/Global",
                            ],
                        },
                    },
                    required: ["country_name", "area"],
                },
            },
            required: [
                "interestInCompany",
                "role",
                "location",
                "jobTitle",
                "yearsOfExperience",
            ],
        },
    },
};

export async function suggestMarketRate(jsonData: any): Promise<string> {
    const { role, yearsOfExperience, location } = jsonData;
    const missingParams: string[] = [];
    if (!role?.title) {
        missingParams.push("role");
    }
    if (!yearsOfExperience) {
        missingParams.push("yearsOfExperience");
    }
    if (!location?.countryName && !location?.area) {
        missingParams.push("location");
    }
    if (!jsonData.interestInCompany) {
        missingParams.push("interestInCompany");
    }
    if (!jsonData.responsibilities || !jsonData.responsibilities.length) {
        missingParams.push("responsibilities");
    }
    if (missingParams.length > 0) {
        const errorMsg = `{"error": "Missing required parameters: ${missingParams.join(
            ", ",
        )}"}`;

        console.log("[ERROR MESSAGE]", errorMsg);

        return errorMsg;
    }

    const { title, modifier } = role;
    const result = await getTemplatePromptContext({
        jobTitle: `${modifier} ${title}`,
        yearsOfExperience: yearsOfExperience,
        location: location,
    });

    // Convert result object to JSON string for passing through tool call
    return JSON.stringify(result);
}

export async function suggestResponsibilities(
    role: string,
    industry: string = "web3",
    context: string = "",
): Promise<{
    responsibilities: string[];
    explanation: string;
}> {
    const cache_key = JSON.stringify({ role, industry });
    if (responsibilitiesCache[cache_key]) {
        return responsibilitiesCache[cache_key];
    }

    return handleOpenAIRequest(async () => {
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                {
                    role: "system",
                    content: ResponsibilitiesSystemPrompt,
                },
                {
                    role: "user",
                    content: ResponsibilitiesUserPrompt(
                        role,
                        industry,
                        context,
                    ),
                },
            ],
            response_format: { type: "json_object" },
        });

        if (!response.choices[0].message.content) {
            throw new Error("No response content from OpenAI");
        }
        const result = JSON.parse(response.choices[0].message.content);
        responsibilitiesCache[cache_key] = result;
        return result;
    });
}
