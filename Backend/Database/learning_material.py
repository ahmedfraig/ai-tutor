import chromadb
from chromadb.config import Settings
import json

class LessonVectorDB:
    def __init__(self, path="./chroma_db"):
        # Initialize persistent client
        self.client = chromadb.PersistentClient(path=path)
        # Create or get the collection
        self.collection = self.client.get_or_create_collection(name="user_lessons")
    def _generate_id(self, user_id, lesson_id):
        return f"{user_id}_{lesson_id}"


    def update_lesson_component(self, user_id, lesson_id, **kwargs):
        unique_id = self._generate_id(user_id, lesson_id)
        existing = self.collection.get(ids=[unique_id])

        if existing['metadatas']:
            new_metadata = existing['metadatas'][0]
        else:
            new_metadata = {"user_id": user_id, "lesson_id": lesson_id, 
                            "summary": "", "flipcards": "", "questions": "", "ocr": ""}

        for key, value in kwargs.items():
            # CHECK: If the value is a list or dict, convert it to a JSON string
            if isinstance(value, (list, dict)):
                new_metadata[key] = json.dumps(value)
            else:
                new_metadata[key] = value

        self.collection.upsert(
            ids=[unique_id],
            metadatas=[new_metadata],
            documents=[f"Lesson data for {unique_id}"]
        )

    def get_component(self, user_id, lesson_id, component_name):
        """
        Retrieves a specific component (summary, flipcards, questions, or ocr)
        """
        unique_id = self._generate_id(user_id, lesson_id)
        result = self.collection.get(ids=[unique_id])
        if result['metadatas']:
            return result['metadatas'][0].get(component_name, "Component not found.")
        return ""
    
    def get_summary(self, user_id, lesson_id):
        return self.get_component(user_id, lesson_id, "summary")

    def get_flipcards(self, user_id, lesson_id):
        unique_id = self._generate_id(user_id, lesson_id)
        result = self.collection.get(ids=[unique_id])

        if result['metadatas']:
            flipcards = result['metadatas'][0].get("flippcards", "")
            try:
                # Convert the string back into a Python list/dict
                return json.loads(flipcards)
            except (json.JSONDecodeError, TypeError):
                return flipcards
        return []

    def get_questions(self, user_id, lesson_id):
        unique_id = self._generate_id(user_id, lesson_id)
        result = self.collection.get(ids=[unique_id])

        if result['metadatas']:
            raw_questions = result['metadatas'][0].get("questions", "")
            try:
                # Convert the string back into a Python list/dict
                return json.loads(raw_questions)
            except (json.JSONDecodeError, TypeError):
                return raw_questions
        return []

    def get_ocr(self, user_id, lesson_id):
        return self.get_component(user_id, lesson_id, "ocr")
