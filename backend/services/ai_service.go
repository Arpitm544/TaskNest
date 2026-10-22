package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type GroqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GroqRequest struct {
	IncludeReasoning *bool         `json:"include_reasoning,omitempty"`
	Model            string        `json:"model"`
	Messages         []GroqMessage `json:"messages"`
}

type GroqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func CallGroq(prompt string) (string, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		log.Printf("[AI] CRITICAL ERROR: GROQ_API_KEY is not set in environment")
		return "", fmt.Errorf("GROQ_API_KEY not set")
	}
	log.Printf("[AI] Calling Groq API")

	model := strings.TrimSpace(os.Getenv("GROQ_MODEL"))
	if model == "" {
		model = "openai/gpt-oss-20b"
	}
	url := "https://api.groq.com/openai/v1/chat/completions"
	reqBody := GroqRequest{
		Model: model,
		Messages: []GroqMessage{
			{Role: "system", Content: "You are a helpful assistant for TaskNest, a task management platform. Provide concise, structured JSON responses when asked."},
			{Role: "user", Content: prompt},
		},
	}

	if strings.HasPrefix(model, "openai/gpt-oss-") {
		includeReasoning := false
		reqBody.IncludeReasoning = &includeReasoning
	}
	jsonData, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[AI] Request failed: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("[AI] API Error (Status %d): %s", resp.StatusCode, string(body))
		return "", fmt.Errorf("Groq API error: %s", string(body))
	}

	var groqResp GroqResponse
	if err := json.Unmarshal(body, &groqResp); err != nil {
		log.Printf("[AI] JSON Parse Error: %v", err)
		return "", err
	}

	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("no response from Groq")
	}

	return groqResp.Choices[0].Message.Content, nil
}

func PredictTaskPriority(title, description string) (string, error) {
	prompt := fmt.Sprintf("Analyze this task and determine its priority (Low, Medium, High, or Critical). Return ONLY the priority word itself. No punctuation, no explanation. Task: %s - %s", title, description)
	resp, err := CallGroq(prompt)
	if err != nil {
		return "", err
	}
	log.Printf("[AI] Priority Prediction for '%s': %s", title, resp)
	return strings.TrimSpace(resp), nil
}

func SuggestMilestones(title, description, subject string) ([]string, error) {
	prompt := fmt.Sprintf("Analyze this task for the subject '%s': Title: '%s', Description: '%s'. Suggest 3-5 logical, professional milestones required to complete it. Return ONLY a raw JSON array of strings. Focus strictly on academic and project execution steps.", subject, title, description)
	resp, err := CallGroq(prompt)
	if err != nil {
		return nil, err
	}
	log.Printf("[AI] Milestone Suggestion for '%s': %s", title, resp)

	var milestones []string
	cleanedResp := cleanJSONResponse(resp)

	if err := json.Unmarshal([]byte(cleanedResp), &milestones); err != nil {
		return nil, fmt.Errorf("failed to parse milestones: %v", err)
	}
	return milestones, nil
}

func SuggestLabels(title, description string) ([]string, error) {
	prompt := fmt.Sprintf("Analyze this task: Title: '%s', Description: '%s'. Suggest 3-5 relevant, short, one-word tags/labels (e.g., frontend, bug, api, research, design). Return ONLY a raw JSON array of strings. No extra text.", title, description)
	resp, err := CallGroq(prompt)
	if err != nil {
		return nil, err
	}
	log.Printf("[AI] Label Suggestion for '%s': %s", title, resp)

	var labels []string
	cleanedResp := cleanJSONResponse(resp)

	if err := json.Unmarshal([]byte(cleanedResp), &labels); err != nil {
		return nil, fmt.Errorf("failed to parse labels: %v", err)
	}
	return labels, nil
}

func cleanJSONResponse(resp string) string {
	fmt.Printf("[AI] RAW Response: %s\n", resp)

	startIdx := strings.IndexAny(resp, "[{")
	if startIdx != -1 {
		char := resp[startIdx]
		endChar := "]"
		if char == '{' {
			endChar = "}"
		}
		endIdx := strings.LastIndex(resp, endChar)
		if endIdx != -1 && endIdx > startIdx {
			return strings.TrimSpace(resp[startIdx : endIdx+1])
		}
	}

	if start := strings.Index(resp, "```"); start != -1 {
		content := resp[start+3:]
		if nl := strings.Index(content, "\n"); nl != -1 {
			content = content[nl+1:]
		}
		if end := strings.LastIndex(content, "```"); end != -1 {
			return strings.TrimSpace(content[:end])
		}
	}

	return strings.TrimSpace(resp)
}

func RecommendAssignees(taskSubject string, candidates []map[string]interface{}) (string, error) {
	candidatesJSON, _ := json.Marshal(candidates)
	prompt := fmt.Sprintf("Given a task about '%s' and these candidates: %s, who is the best fit? Consider their 'field' and current 'active_tasks'. Return a concise explanation of why the top candidate is chosen.", taskSubject, string(candidatesJSON))
	return CallGroq(prompt)
}

func ImproveTaskWriting(title, description, subject string) (map[string]string, error) {
	prompt := fmt.Sprintf(`Improve the following task details for a student collaboration platform. 
Title: %s
Subject: %s
Description: %s

Please:
1. Rewrite the title to be professional and concise.
2. Improve grammar and clarity in the description.
3. Structure requirements clearly using bullet points within the description string.
4. Ensure the subject is accurately represented.

CRITICAL: Return ONLY a raw JSON object with keys "title", "subject", and "description". 
The "description" MUST be a single string (use \n for newlines), NOT a nested object or array.`, title, subject, description)

	resp, err := CallGroq(prompt)
	if err != nil {
		return nil, err
	}

	cleanedResp := cleanJSONResponse(resp)

	var rawResult map[string]interface{}
	if err := json.Unmarshal([]byte(cleanedResp), &rawResult); err != nil {
		return nil, fmt.Errorf("failed to parse improved text: %v", err)
	}
	result := make(map[string]string)
	for k, v := range rawResult {
		switch val := v.(type) {
		case string:
			result[k] = val
		default:
			jsonBytes, _ := json.MarshalIndent(val, "", "  ")
			result[k] = string(jsonBytes)
		}
	}

	return result, nil
}
