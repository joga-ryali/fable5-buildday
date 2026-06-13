import sys, json, re, os
sys.path.insert(0, 'lib')
from verifier import verify_claim
cases = json.load(open('harness/legal_corpus.json'))['cases']
def label(c):
    return c.get('source_filing') or ''
results=[]
for c in cases:
    ot = c.get('original_text') or None
    r = verify_claim(claim=c['claim'], citation=c.get('citation_as_written'),
                     source_url=c.get('source_url'), source_excerpt=ot,
                     source_label=label(c), do_resolve=True)
    ok = r['verdict']==c['expected_verdict']
    results.append((c,r,ok))
    mark='PASS' if ok else 'FAIL'
    print(f"  {c['source_filing'][:34]:36} {str(c['hallucination_type'] or 'control'):20} got={r['verdict']:20} exp={c['expected_verdict']:20} [{mark}] res={r['citation_resolution_status']}")
p=sum(1 for _,_,ok in results if ok)
print(f"\nLegal: {p}/{len(results)} = {round(p/len(results),3)}")
