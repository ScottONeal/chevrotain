/**
 * A parser for the TinyC programing language
 * https://tomassetti.me/ebnf/#examples (Scroll down a bit)
 */

const chevrotain = require("chevrotain")

// ----------------- lexer -----------------
const Lexer = chevrotain.Lexer
const Parser = chevrotain.Parser

const allTokens = []
function createToken(options) {
    const newToken = chevrotain.createToken(options)
    allTokens.push(newToken)
    return newToken
}

const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED,
    line_breaks: true
})

const If = createToken({ name: "If", pattern: /if/ })
const Else = createToken({ name: "Else", pattern: /else/ })
const While = createToken({ name: "While", pattern: /while/ })
const Do = createToken({ name: "Do", pattern: /do/ })
const LCurly = createToken({ name: "LCurly", pattern: /{/ })
const RCurly = createToken({ name: "RCurly", pattern: /}/ })
const LParen = createToken({ name: "LParen", pattern: /\(/ })
const RParen = createToken({ name: "RParen", pattern: /\)/ })
const SemiColon = createToken({ name: "SemiColon", pattern: /;/ })
const Equals = createToken({ name: "Equals", pattern: /=/ })
const LessThan = createToken({ name: "LessThan", pattern: /</ })
const Plus = createToken({ name: "Plus", pattern: /\+/ })
const Minus = createToken({ name: "Minus", pattern: /-/ })
const INT = createToken({ name: "INT", pattern: /[0-9]+/ })
// TODO: resolve ambiguity keywords vs identifiers
const ID = createToken({ name: "ID", pattern: /[a-z]+/ })

const TinyCLexer = new Lexer(allTokens)

// ----------------- parser -----------------

class TinyCParser extends chevrotain.Parser {
    // Unfortunately no support for class fields with initializer in ES2015, only in ES2016...
    // so the parsing rules are defined inside the constructor, as each parsing rule must be initialized by
    // invoking RULE(...)
    // see: https://github.com/jeffmo/es-class-fields-and-static-properties
    constructor(input) {
        super(input, allTokens)

        // not mandatory, using $ (or any other sign) to reduce verbosity (this. this. this. this. .......)
        const $ = this

        $.RULE("program", () => {
            $.MANY(() => {
                $.SUBRULE($.statement)
            })
        })

        // ----------------------------
        // the parsing methods
        $.RULE("statement", () => {
            // prettier-ignore
            $.OR([
                {ALT: () => {$.SUBRULE($.ifStatement)}},
                {ALT: () => {$.SUBRULE($.whileStatement)}},
                {ALT: () => {$.SUBRULE($.doStatement)}},
                {ALT: () => {$.SUBRULE($.blockStatement)}},
                {ALT: () => {$.SUBRULE($.expressionStatement)}},
                {ALT: () => {$.SUBRULE($.emptyStatement)}}
            ])
        })

        $.RULE("ifStatement", () => {
            $.CONSUME(If)
            $.SUBRULE($.paren_expr)
            $.SUBRULE($.statement)
            $.OPTION(() => {
                $.CONSUME(Else)
                $.SUBRULE2($.statement)
            })
        })

        $.RULE("whileStatement", () => {
            $.CONSUME(While)
            $.SUBRULE($.paren_expr)
            $.SUBRULE($.statement)
        })

        $.RULE("doStatement", () => {
            $.CONSUME(Do)
            $.SUBRULE($.statement)
            $.CONSUME(While)
            $.SUBRULE($.paren_expr)
            $.CONSUME(SemiColon)
        })

        $.RULE("blockStatement", () => {
            $.CONSUME(LCurly)
            $.MANY(() => {
                $.SUBRULE($.statement)
            })
            $.CONSUME(RCurly)
        })

        $.RULE("expressionStatement", () => {
            $.SUBRULE($.expression)
            $.CONSUME(SemiColon)
        })

        $.RULE("expression", () => {
            // prettier-ignore
            $.OR([
                {ALT: () => {$.SUBRULE($.assignExpression)}},
                {ALT: () => {$.SUBRULE($.relationExpression)}}
            ])
        })

        $.RULE("relationExpression", () => {
            $.SUBRULE($.AdditionExpression)
            $.MANY(() => {
                $.CONSUME(LessThan)
                $.SUBRULE2($.AdditionExpression)
            })
        })

        $.RULE("AdditionExpression", () => {
            $.SUBRULE($.term)
            $.MANY(() => {
                // prettier-ignore
                $.OR([
                    {ALT: () => {$.CONSUME(Plus)}},
                    {ALT: () => {$.CONSUME(Minus)}}
                ])
                $.SUBRULE2($.term)
            })
        })

        $.RULE("assignExpression", () => {
            $.CONSUME(ID)
            $.CONSUME(Equals)
            $.SUBRULE($.expression)
        })

        $.RULE("term", () => {
            // prettier-ignore
            $.OR([
                {ALT: () => {$.CONSUME(ID)}},
                {ALT: () => {$.CONSUME(INT)}},
                {ALT: () => {$.SUBRULE($.paren_expr)}}

            ])
        })

        $.RULE("paren_expr", () => {
            $.CONSUME(LParen)
            $.SUBRULE($.expression)
            $.CONSUME(RParen)
        })

        $.RULE("emptyStatement", () => {
            $.CONSUME(SemiColon)
        })

        // very important to call this after all the rules have been defined.
        // otherwise the parser may not work correctly as it will lack information
        // derived during the self analysis phase.
        Parser.performSelfAnalysis(this)
    }
}

// ----------------- wrapping it all together -----------------

// reuse the same parser instance.
const parser = new TinyCParser([])

module.exports = function(text) {
    const lexResult = TinyCLexer.tokenize(text)

    // setting a new input will RESET the parser instance's state.
    parser.input = lexResult.tokens

    // any top level rule may be used as an entry point
    const value = parser.program()

    return {
        value: value, // this is a pure grammar, the value will always be <undefined>
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}
