"""
충청남도의회 AI의정브레인 - PDF 인덱싱 스크립트
임베딩: BGE-M3 (한국어 특화)
사용법: python index_docs.py
"""

import os
import sys
from pypdf import PdfReader
import chromadb
from FlagEmbedding import BGEM3FlagModel

# ── 설정 ──────────────────────────────────────────
DOCS_DIR      = "./docs"
DB_DIR        = "./chroma_db"
CHUNK_SIZE    = 800
CHUNK_OVERLAP = 100
BATCH_SIZE    = 16
# ──────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text += t + "\n"
    return text

def split_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start:start + chunk_size]
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks

def main():
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        print(f"📁 {DOCS_DIR} 폴더를 생성했습니다. PDF 파일을 넣고 다시 실행하세요.")
        sys.exit(0)

    pdf_files = [f for f in os.listdir(DOCS_DIR) if f.endswith(".pdf")]
    if not pdf_files:
        print(f"❌ {DOCS_DIR} 폴더에 PDF 파일이 없습니다.")
        sys.exit(1)

    print(f"📄 발견된 PDF: {len(pdf_files)}개")
    print(f"🔗 BGE-M3 임베딩 모델 로딩 중...")
    model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
    print(f"✅ BGE-M3 로딩 완료")

    client = chromadb.PersistentClient(path=DB_DIR)
    try:
        client.delete_collection("assembly_docs")
        print("🗑️  기존 DB 삭제 후 재생성")
    except:
        pass

    collection = client.create_collection(name="assembly_docs")
    total_chunks = 0

    for pdf_file in pdf_files:
        pdf_path = os.path.join(DOCS_DIR, pdf_file)
        doc_name = os.path.splitext(pdf_file)[0]
        print(f"\n📖 처리 중: {pdf_file}")

        try:
            text = extract_text_from_pdf(pdf_path)
            if not text.strip():
                print(f"  ⚠️  텍스트 추출 실패")
                continue

            chunks = split_text(text)
            print(f"  ✅ {len(chunks)}개 청크 생성, 임베딩 중...")

            all_embeddings = []
            for i in range(0, len(chunks), BATCH_SIZE):
                batch = chunks[i:i+BATCH_SIZE]
                result = model.encode(batch, batch_size=BATCH_SIZE, max_length=512)
                all_embeddings.extend(result["dense_vecs"].tolist())
                print(f"  📊 {min(i+BATCH_SIZE, len(chunks))}/{len(chunks)} 완료")

            ids       = [f"{doc_name}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [{"source": doc_name, "chunk_index": i} for i in range(len(chunks))]

            collection.add(
                documents=chunks,
                embeddings=all_embeddings,
                ids=ids,
                metadatas=metadatas
            )
            total_chunks += len(chunks)

        except Exception as e:
            print(f"  ❌ 오류: {e}")
            import traceback; traceback.print_exc()

    print(f"\n✅ 인덱싱 완료! 총 {total_chunks}개 청크가 저장되었습니다.")

if __name__ == "__main__":
    main()

