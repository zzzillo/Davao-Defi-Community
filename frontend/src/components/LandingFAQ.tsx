import { useState } from 'react'

const faqs = [
  {
    question: 'What is Davao DeFi Community?',
    answer: 'A community for people interested in DeFi and Web3 to connect, learn, share ideas, and build together.',
  },
  {
    question: 'Who can join?',
    answer: 'Anyone curious about Web3 is welcome, from beginners to experienced builders.',
  },
  {
    question: 'Do I need Web3 experience to take part?',
    answer: 'No. You can join to learn, meet others, and explore the space at your own pace.',
  },
  {
    question: 'What happens at community meetups?',
    answer: 'Meetups bring local builders and Web3 enthusiasts together to connect, share ideas, and explore DeFi.',
  },
  {
    question: 'How do I find the next event?',
    answer: 'Check the Events page for upcoming community meetups and event details.',
  },
]

export default function LandingFAQ() {
  const [openItems, setOpenItems] = useState<Set<number>>(() => new Set())

  const toggleItem = (index: number) => {
    setOpenItems((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <section id="community-faqs" aria-label="Community FAQs" className="w-full bg-transparent px-6 py-14 sm:px-10 sm:py-20 lg:px-16">
      <div className="mx-auto w-full max-w-[1160px]">
        <div className="grid gap-2">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              data-scroll-reveal
              className={`scroll-reveal ${openItems.has(index) ? 'bg-[#F7F8F7] dark:bg-[#1a1a1a]' : 'bg-white dark:bg-black'}`}
            >
              <button
                type="button"
                aria-expanded={openItems.has(index)}
                aria-controls={`faq-answer-${index}`}
                onClick={() => toggleItem(index)}
                className={`group flex w-full cursor-pointer items-center justify-between gap-6 px-6 py-6 text-left text-lg font-medium text-[#082923] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] dark:text-[#f5f5f5] sm:px-10 sm:py-7 sm:text-2xl ${openItems.has(index) ? 'bg-[#F7F8F7] dark:bg-[#1a1a1a]' : 'bg-white hover:bg-[#F7F8F7] focus-visible:bg-[#F7F8F7] dark:bg-black dark:hover:bg-[#141414] dark:focus-visible:bg-[#141414]'}`}
              >
                <span>{faq.question}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={`h-6 w-6 shrink-0 text-inherit transition-transform duration-300 ease-in-out ${openItems.has(index) ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 9 7 7 7-7" />
                </svg>
              </button>
              <div
                id={`faq-answer-${index}`}
                aria-hidden={!openItems.has(index)}
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${openItems.has(index) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className={`px-6 pb-6 transition-opacity duration-200 ease-in-out sm:px-10 sm:pb-8 ${openItems.has(index) ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="max-w-4xl text-base leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-lg">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
