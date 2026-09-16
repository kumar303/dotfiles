" Avoid treating an outer interpolated string as a quoted hash key when an
" interpolated expression contains a double-quoted string followed by a colon.
syntax clear rubySymbol

syntax match rubySymbol "[]})\"':]\@1<!:\%(\^\|\~@\|\~\|<<\|<=>\|<=\|<\|===\|[=!]=\|[=!]\~\|!@\|!\|>>\|>=\|>\||\|-@\|-\|/\|\[]=\|\[]\|\*\*\|\*\|&\|%\|+@\|+\|`\)" contains=rubySymbolDelimiter
syntax match rubySymbol "[]})\"':]\@1<!:\$\%(-.\|[`~<=>_,;:!?/.'\"@$*\&+0]\)" contains=rubySymbolDelimiter
syntax match rubySymbol "[]})\"':]\@1<!:\%(\$\|@@\=\)\=\%(\h\|[^\x00-\x7F]\)\%(\w\|[^\x00-\x7F]\)*" contains=rubySymbolDelimiter
syntax match rubySymbol "[]})\"':]\@1<!:\%(\h\|[^\x00-\x7F]\)\%(\w\|[^\x00-\x7F]\)*\%([?!=]>\@!\)\=" contains=rubySymbolDelimiter
syntax region rubySymbol matchgroup=rubySymbolDelimiter start="[]})\"':]\@1<!:'" end="'" skip="\\\\\|\\'" contains=rubyQuoteEscape,rubyBackslashEscape
syntax region rubySymbol matchgroup=rubySymbolDelimiter start="[]})\"':]\@1<!:\"" end="\"" skip="\\\\\|\\\"" contains=@rubyStringSpecial

syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%s{" end="}" skip="\\\\\|\\}" contains=rubyBackslashEscape,rubyCurlyBraceEscape,rubyNestedCurlyBraces
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%s<" end=">" skip="\\\\\|\\>" contains=rubyBackslashEscape,rubyAngleBracketEscape,rubyNestedAngleBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%s\[" end="\]" skip="\\\\\|\\\]" contains=rubyBackslashEscape,rubySquareBracketEscape,rubyNestedSquareBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%s(" end=")" skip="\\\\\|\\)" contains=rubyBackslashEscape,rubyParenthesisEscape,rubyNestedParentheses
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%i{" end="}" skip="\\\\\|\\}" contains=rubyBackslashEscape,rubySpaceEscape,rubyCurlyBraceEscape,rubyNestedCurlyBraces
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%i<" end=">" skip="\\\\\|\\>" contains=rubyBackslashEscape,rubySpaceEscape,rubyAngleBracketEscape,rubyNestedAngleBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%i\[" end="\]" skip="\\\\\|\\\]" contains=rubyBackslashEscape,rubySpaceEscape,rubySquareBracketEscape,rubyNestedSquareBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%i(" end=")" skip="\\\\\|\\)" contains=rubyBackslashEscape,rubySpaceEscape,rubyParenthesisEscape,rubyNestedParentheses
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%I\z([~`!@#$%^&*_\-+=|\:;\"',.?/]\)" end="\z1" skip="\\\\\|\\\z1" contains=@rubyStringSpecial nextgroup=@rubyModifier skipwhite
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%I{" end="}" skip="\\\\\|\\}" contains=@rubyStringSpecial,rubyNestedCurlyBraces
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%I<" end=">" skip="\\\\\|\\>" contains=@rubyStringSpecial,rubyNestedAngleBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%I\[" end="\]" skip="\\\\\|\\\]" contains=@rubyStringSpecial,rubyNestedSquareBrackets
syntax region rubySymbol matchgroup=rubyPercentSymbolDelimiter start="%I(" end=")" skip="\\\\\|\\)" contains=@rubyStringSpecial,rubyNestedParentheses

syntax match rubySymbol "\%(\w\|[^\x00-\x7F]\)\%(\w\|[^\x00-\x7F]\)*[?!]\=::\@!"he=e-1 contained containedin=rubyBlockParameterList,rubyCurlyBlock
syntax match rubySymbol "[]})\"':]\@1<!\<\%(\h\|[^\x00-\x7F]\)\%(\w\|[^\x00-\x7F]\)*[!?]\=:[[:space:],;]\@="he=e-1
syntax match rubySymbol "[[:space:],{(]\%(\h\|[^\x00-\x7F]\)\%(\w\|[^\x00-\x7F]\)*[!?]\=:[[:space:],;]\@="hs=s+1,he=e-1
syntax match rubySymbol "'\%(\\.\|[^']\)*'::\@!"he=e-1 contains=rubyQuoteEscape,rubyBackslashEscape,rubySingleQuoteSymbolDelimiter
syntax match rubySymbol "\"\%(\\.\|#\%({\)\@!\|[^\"#]\)*\"::\@!"he=e-1 contains=@rubyStringSpecial,rubyDoubleQuoteSymbolDelimiter
